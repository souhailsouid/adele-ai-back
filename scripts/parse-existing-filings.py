#!/usr/bin/env python3
"""
Script pour parser manuellement les filings 13F existants dans Supabase
Utilise le même code que le Lambda parser-13f
"""

import os
import sys
import json
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Ajouter le chemin du parser pour importer les fonctions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../workers/parser-13f/src'))

# Charger .env depuis la racine du projet si disponible
try:
    from dotenv import load_dotenv
    from pathlib import Path
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variables d'environnement manquantes!")
    print("Définir SUPABASE_URL et SUPABASE_SERVICE_KEY ou créer un fichier .env")
    sys.exit(1)

def parse_13f_file(content: str, url: str) -> list:
    """Parse un fichier 13F XML et extrait les holdings"""
    holdings = []
    
    try:
        # Parser le XML avec BeautifulSoup (html.parser fonctionne aussi pour XML)
        soup = BeautifulSoup(content, "html.parser")
        
        # Structure 13F XML: <infoTable> contient chaque holding (avec namespace)
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
            try:
                value_text = value_elem.get_text(strip=True) if value_elem else "0"
                value = int(float(value_text.replace(",", ""))) if value_text else 0
                
                # Détecter le format (dollars vs milliers) - même logique que le parser Lambda
                shares_text = ssh_prnamt_elem.get_text(strip=True) if ssh_prnamt_elem else "0"
                shares = int(float(shares_text.replace(",", ""))) if shares_text else 0
                
                if value > 1_000_000 and shares > 0:
                    price_if_thousands = (value * 1000) / shares
                    if price_if_thousands > 1000:
                        value_usd = value // 1000  # Convertir dollars → milliers
                    else:
                        value_usd = value  # Déjà en milliers
                else:
                    value_usd = value  # Valeur en milliers de dollars
            except:
                value_usd = 0
            
            try:
                shares_text = ssh_prnamt_elem.get_text(strip=True) if ssh_prnamt_elem else "0"
                shares = int(float(shares_text.replace(",", ""))) if shares_text else 0
            except:
                shares = 0
            
            # Type (stock, call, put)
            put_call = put_call_elem.get_text(strip=True).upper() if put_call_elem else ""
            holding_type = "put" if put_call == "PUT" else ("call" if put_call == "CALL" else "stock")
            
            # Ticker (approximation depuis le nom)
            ticker = name.upper()[:10] if name else ""
            
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
    """Extraire le ticker depuis le nom"""
    return name.upper()[:10] if name else ""

def main():
    print("🔍 Récupération des filings non parsés depuis Supabase...")
    
    # Initialiser Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Récupérer tous les filings (DISCOVERED ou PARSED mais sans holdings)
    # D'abord, récupérer tous les filings
    result = supabase.table("fund_filings")\
        .select("id, fund_id, accession_number, form_type, filing_date, status, funds!inner(cik, name)")\
        .order("filing_date", desc=True)\
        .execute()
    
    all_filings = result.data
    print(f"📋 Trouvé {len(all_filings)} filings au total")
    
    # Vérifier lesquels n'ont pas de holdings
    filings_to_parse = []
    for filing in all_filings:
        filing_id = filing["id"]
        # Vérifier si ce filing a des holdings
        holdings_result = supabase.table("fund_holdings")\
            .select("id")\
            .eq("filing_id", filing_id)\
            .limit(1)\
            .execute()
        
        if len(holdings_result.data) == 0:
            # Pas de holdings, à parser
            filings_to_parse.append(filing)
    
    print(f"📋 {len(filings_to_parse)} filings sans holdings à parser\n")
    
    if len(filings_to_parse) == 0:
        print("✅ Tous les filings ont déjà des holdings!")
        return
    
    filings = filings_to_parse
    
    # Parser chaque filing
    for filing in filings:
        filing_id = filing["id"]
        fund_id = filing["fund_id"]
        accession_number = filing["accession_number"]
        cik = filing["funds"]["cik"]
        fund_name = filing["funds"]["name"]
        
        print(f"\n📄 Parsing filing: {accession_number}")
        print(f"   Fund: {fund_name} (CIK: {cik})")
        
        try:
            # Construire l'URL XML (fichier brut, pas la version XSL)
            accession_no_dashes = accession_number.replace("-", "")
            cik_clean = cik.lstrip("0")
            xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_clean}/{accession_no_dashes}/infotable.xml"
            
            print(f"   URL: {xml_url}")
            
            # Télécharger le fichier XML
            headers = {"User-Agent": "ADEL AI (contact@adel.ai)"}
            response = requests.get(xml_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Parser le XML
            holdings = parse_13f_file(response.text, xml_url)
            
            if len(holdings) == 0:
                print(f"   ⚠️  Aucun holding trouvé, skip")
                continue
            
            # Insérer les holdings
            print(f"   💾 Insertion de {len(holdings)} holdings...")
            for holding in holdings:
                supabase.table("fund_holdings").insert({
                    "fund_id": fund_id,
                    "filing_id": filing_id,
                    "cik": cik,  # Ajouter le CIK pour simplifier les requêtes
                    "ticker": holding["ticker"],
                    "cusip": holding["cusip"],
                    "shares": holding["shares"],
                    "market_value": holding["market_value"],
                    "type": holding["type"]
                }).execute()
            
            # Mettre à jour le statut
            supabase.table("fund_filings").update({
                "status": "PARSED",
                "updated_at": "now()"
            }).eq("id", filing_id).execute()
            
            print(f"   ✅ Parsing réussi! {len(holdings)} holdings insérés")
            
        except Exception as e:
            print(f"   ❌ Erreur: {str(e)}")
            # Marquer comme FAILED
            try:
                supabase.table("fund_filings").update({
                    "status": "FAILED",
                    "updated_at": "now()"
                }).eq("id", filing_id).execute()
            except:
                pass
            continue
    
    print(f"\n✅ Terminé! {len(filings)} filings traités")

if __name__ == "__main__":
    main()

