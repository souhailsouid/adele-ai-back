"""
Lambda Python pour parser les fichiers 13F EDGAR
Déclenché par EventBridge quand un nouveau 13F est découvert
"""

import json
import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

def handler(event, context):
    """
    Event structure:
    {
        "detail": {
            "fund_id": 1,
            "cik": "0001234567",
            "accession_number": "0001234567-24-000001",
            "filing_url": "https://www.sec.gov/..."
        }
    }
    """
    print(f"Parser 13F triggered: {json.dumps(event)}")
    
    detail = event.get("detail", {})
    fund_id = detail.get("fund_id")
    cik = detail.get("cik")
    accession_number = detail.get("accession_number")
    filing_url = detail.get("filing_url")
    
    if not all([fund_id, cik, accession_number, filing_url]):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing required fields"})
        }
    
    try:
        # Initialiser Supabase
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # 1. Construire l'URL du fichier XML depuis l'accession number
        # Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{accession_no_dashes}/infotable.xml
        # Exemple: 0001649339-25-000007 -> 000164933925000007
        accession_no_dashes = accession_number.replace("-", "")
        cik_clean = cik.lstrip("0")  # Enlever les zéros de padding
        xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_clean}/{accession_no_dashes}/infotable.xml"
        
        print(f"Downloading 13F XML from: {xml_url}")
        print(f"Accession number: {accession_number}")
        print(f"CIK: {cik}")
        
        # 2. Télécharger le fichier XML avec User-Agent
        headers = {
            "User-Agent": "ADEL AI (contact@adel.ai)"
        }
        response = requests.get(xml_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 3. Récupérer le filing_id (depuis l'event ou depuis la DB)
        filing_id = detail.get("filing_id")
        if not filing_id:
            # Fallback: récupérer depuis la DB
            filing_result = supabase.table("fund_filings").select("id").eq("accession_number", accession_number).single().execute()
            filing_id = filing_result.data["id"]
        
        # 4. Parser le XML
        holdings = parse_13f_file(response.text, xml_url)
        
        # 4. Insérer les holdings
        for holding in holdings:
            supabase.table("fund_holdings").insert({
                "fund_id": fund_id,
                "filing_id": filing_id,
                "cik": cik,  # Ajouter le CIK pour simplifier les requêtes
                "ticker": holding.get("ticker"),
                "cusip": holding.get("cusip"),
                "shares": holding.get("shares"),
                "market_value": holding.get("market_value"),
                "type": holding.get("type", "stock")
            }).execute()
        
        # 5. Mettre à jour le statut
        supabase.table("fund_filings").update({
            "status": "PARSED",
            "updated_at": "now()"
        }).eq("id", filing_id).execute()
        
        print(f"Successfully parsed {len(holdings)} holdings for filing {accession_number}")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "success": True,
                "filing_id": filing_id,
                "holdings_count": len(holdings)
            })
        }
        
    except Exception as e:
        print(f"Error parsing 13F: {str(e)}")
        # Marquer comme FAILED
        try:
            supabase.table("fund_filings").update({
                "status": "FAILED",
                "updated_at": "now()"
            }).eq("accession_number", accession_number).execute()
        except:
            pass
        
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


def parse_13f_file(content: str, url: str) -> list:
    """
    Parse un fichier 13F XML et extrait les holdings
    """
    holdings = []
    
    try:
        # Parser le XML avec BeautifulSoup (html.parser fonctionne aussi pour XML)
        soup = BeautifulSoup(content, "html.parser")
        
        # Structure 13F XML: <infoTable> contient chaque holding (avec namespace)
        # Chercher avec et sans namespace
        info_tables = soup.find_all("infotable") or soup.find_all("n1:infotable")
        
        print(f"Found {len(info_tables)} holdings in XML")
        
        for table in info_tables:
            # Extraire les champs (camelCase dans le XML)
            name_elem = table.find("nameofissuer") or table.find("n1:nameofissuer")
            cusip_elem = table.find("cusip") or table.find("n1:cusip")
            value_elem = table.find("value") or table.find("n1:value")
            
            # Shares: <shrsOrPrnAmt><sshPrnamt>...</sshPrnamt></shrsOrPrnAmt>
            shrs_elem = table.find("shrsorprnamt") or table.find("n1:shrsorprnamt")
            if shrs_elem:
                ssh_prnamt_elem = shrs_elem.find("sshprnamt") or shrs_elem.find("n1:sshprnamt")
            else:
                ssh_prnamt_elem = None
            
            put_call_elem = table.find("putcall") or table.find("n1:putcall")
            
            # Extraire les valeurs textuelles
            name = name_elem.get_text(strip=True) if name_elem else ""
            cusip = cusip_elem.get_text(strip=True) if cusip_elem else ""
            
            # Valeurs numériques
            # NOTE: Format SEC 13F - valeurs en milliers de dollars
            # Exception: ARK (CIK 0001697748) utilise parfois des valeurs en dollars
            # On détecte automatiquement: si value > 1M et prix/action > 1000, c'est en dollars
            try:
                value_text = value_elem.get_text(strip=True) if value_elem else "0"
                value = int(float(value_text.replace(",", ""))) if value_text else 0
                
                # Détecter le format (dollars vs milliers)
                # Si la valeur est très grande (> 1M) et qu'on a des shares, vérifier le prix
                shares_text = ssh_prnamt_elem.get_text(strip=True) if ssh_prnamt_elem else "0"
                shares = int(float(shares_text.replace(",", ""))) if shares_text else 0
                
                if value > 1_000_000 and shares > 0:
                    # Calculer prix par action si en milliers
                    price_if_thousands = (value * 1000) / shares
                    # Si prix > 1000, probablement en dollars (convertir en milliers)
                    if price_if_thousands > 1000:
                        value_usd = value // 1000  # Convertir dollars → milliers
                    else:
                        value_usd = value  # Déjà en milliers
                else:
                    value_usd = value  # Valeur en milliers de dollars
            except:
                value_usd = 0
            
            # Shares (déjà extrait ci-dessus pour la détection de format)
            try:
                if shares == 0:  # Si pas encore extrait
                    shares_text = ssh_prnamt_elem.get_text(strip=True) if ssh_prnamt_elem else "0"
                    shares = int(float(shares_text.replace(",", ""))) if shares_text else 0
            except:
                shares = 0
            
            # Type (stock, call, put)
            put_call = put_call_elem.get_text(strip=True).upper() if put_call_elem else ""
            holding_type = "put" if put_call == "PUT" else ("call" if put_call == "CALL" or put_call == "CALL" else "stock")
            
            # Ticker (approximation depuis le nom)
            ticker = extract_ticker(name)
            
            holdings.append({
                "ticker": ticker,
                "cusip": cusip,
                "shares": shares,
                "market_value": value_usd,
                "type": holding_type
            })
        
        print(f"Successfully parsed {len(holdings)} holdings")
        
    except Exception as e:
        print(f"Error parsing XML: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
    
    return holdings


def extract_ticker(name: str) -> str:
    """
    Extraire le ticker depuis le nom (approximation)
    En production, utiliser un mapping CUSIP → Ticker
    """
    # TODO: Implémenter mapping CUSIP → Ticker
    # Pour l'instant, retourner le nom tel quel
    return name.upper()[:10] if name else ""

