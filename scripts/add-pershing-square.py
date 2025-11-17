#!/usr/bin/env python3
"""
Ajouter Pershing Square Capital Management et tester le système dynamique
"""

import os
import sys
import requests
import re
from supabase import create_client, Client
from bs4 import BeautifulSoup
import warnings
from bs4 import XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

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
    print("")
    print("Définir SUPABASE_URL et SUPABASE_SERVICE_KEY:")
    print("  export SUPABASE_URL='https://your-project.supabase.co'")
    print("  export SUPABASE_SERVICE_KEY='your-service-key'")
    print("")
    print("Ou créer un fichier .env à la racine avec:")
    print("  SUPABASE_URL=https://your-project.supabase.co")
    print("  SUPABASE_SERVICE_KEY=your-service-key")
    sys.exit(1)

def parse_13f_file(content: str) -> list:
    """Parse un fichier 13F XML"""
    holdings = []
    try:
        soup = BeautifulSoup(content, "html.parser")
        info_tables = soup.find_all("infotable") or soup.find_all("n1:infotable")
        
        for table in info_tables:
            name_elem = table.find("nameofissuer") or table.find("n1:nameofissuer")
            cusip_elem = table.find("cusip") or table.find("n1:cusip")
            value_elem = table.find("value") or table.find("n1:value")
            
            shrs_elem = table.find("shrsorprnamt") or table.find("n1:shrsorprnamt")
            if shrs_elem:
                ssh_prnamt_elem = shrs_elem.find("sshprnamt") or shrs_elem.find("n1:sshprnamt")
            else:
                ssh_prnamt_elem = None
            
            put_call_elem = table.find("putcall") or table.find("n1:putcall")
            
            name = name_elem.get_text(strip=True) if name_elem else ""
            cusip = cusip_elem.get_text(strip=True) if cusip_elem else ""
            
            try:
                value_text = value_elem.get_text(strip=True) if value_elem else "0"
                value = int(float(value_text.replace(",", ""))) if value_text else 0
                
                shares_text = ssh_prnamt_elem.get_text(strip=True) if ssh_prnamt_elem else "0"
                shares = int(float(shares_text.replace(",", ""))) if shares_text else 0
                
                # Détecter format (comme dans le parser Lambda)
                if value > 1_000_000 and shares > 0:
                    price_if_thousands = (value * 1000) / shares
                    if price_if_thousands > 1000:
                        value_usd = value // 1000  # Convertir dollars → milliers
                    else:
                        value_usd = value
                else:
                    value_usd = value
            except:
                value_usd = 0
                shares = 0
            
            put_call = put_call_elem.get_text(strip=True).upper() if put_call_elem else ""
            holding_type = "put" if put_call == "PUT" else ("call" if put_call == "CALL" else "stock")
            
            ticker = name.upper()[:10] if name else ""
            
            holdings.append({
                "ticker": ticker,
                "cusip": cusip,
                "shares": shares,
                "market_value": value_usd,
                "type": holding_type
            })
    except Exception as e:
        print(f"   Error parsing XML: {str(e)}")
        raise
    
    return holdings

def main():
    print("🔍 Ajout de Pershing Square Capital Management\n")
    print("="*70)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    cik = "0001336528"
    name = "Pershing Square Capital Management, L.P."
    
    # 1. Vérifier si le fond existe déjà
    existing = supabase.table("funds").select("id").eq("cik", cik).execute()
    if existing.data and len(existing.data) > 0:
        print(f"⚠️  Le fond existe déjà (ID: {existing.data[0]['id']})")
        fund_id = existing.data[0]['id']
    else:
        # 2. Créer le fond
        print(f"📊 Création du fond: {name}")
        try:
            fund_result = supabase.table("funds").insert({
                "name": name,
                "cik": cik,
                "tier_influence": 5,
                "category": "hedge_fund"
            }).execute()
            
            # Récupérer l'ID depuis la réponse ou re-query
            if fund_result.data and len(fund_result.data) > 0:
                fund_id = fund_result.data[0]["id"]
            else:
                # Re-query pour obtenir l'ID
                fund_check = supabase.table("funds").select("id").eq("cik", cik).execute()
                if not fund_check.data or len(fund_check.data) == 0:
                    print("❌ Impossible de récupérer l'ID du fond créé")
                    return
                fund_id = fund_check.data[0]["id"]
        except Exception as e:
            print(f"❌ Erreur création fond: {str(e)}")
            return
        print(f"✅ Fond créé (ID: {fund_id})\n")
    
    # 3. Découvrir les filings
    print("🔍 Découverte des filings depuis EDGAR...")
    rssUrl = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=13F-HR&dateb=&owner=include&count=40&output=atom"
    
    response = requests.get(rssUrl, headers={"User-Agent": "ADEL AI (contact@adel.ai)"})
    response.raise_for_status()
    
    xml = response.text
    entries = []
    
    # Parser le feed Atom avec regex
    import re
    entry_pattern = r'<entry>([\s\S]*?)</entry>'
    entry_matches = re.findall(entry_pattern, xml)
    
    for entry_xml in entry_matches:
        # Extraire l'accession number depuis le contenu
        accession_match = re.search(r'<accession-number>([^<]+)</accession-number>', entry_xml)
        filing_date_match = re.search(r'<filing-date>([^<]+)</filing-date>', entry_xml)
        link_match = re.search(r'<link[^>]*href="([^"]+)"', entry_xml)
        
        if accession_match and filing_date_match:
            entries.append({
                "accession_number": accession_match.group(1),
                "filing_date": filing_date_match.group(1),
                "link": link_match.group(1) if link_match else ""
            })
    
    print(f"   {len(entries)} filings trouvés dans EDGAR\n")
    
    # 4. Parser chaque filing
    discovered = 0
    parsed = 0
    
    for entry in entries:
        accessionNumber = entry["accession_number"]
        filing_date = entry["filing_date"]
        
        # Vérifier si existe
        existing_filing = supabase.table("fund_filings").select("id").eq("accession_number", accessionNumber).execute()
        if existing_filing.data and len(existing_filing.data) > 0:
            print(f"   ⏭️  {accessionNumber} déjà existant")
            continue
        try:
            filing_result = supabase.table("fund_filings").insert({
                "fund_id": fund_id,
                "cik": cik,
                "accession_number": accessionNumber,
                "form_type": "13F-HR",
                "filing_date": filing_date,
                "status": "DISCOVERED",
            }).execute()
            
            # Récupérer l'ID
            if filing_result.data and len(filing_result.data) > 0:
                filing_id = filing_result.data[0]["id"]
            else:
                filing_check = supabase.table("fund_filings").select("id").eq("accession_number", accessionNumber).execute()
                if not filing_check.data or len(filing_check.data) == 0:
                    print(f"   ❌ Impossible de récupérer l'ID du filing")
                    continue
                filing_id = filing_check.data[0]["id"]
        except Exception as e:
            print(f"   ❌ Erreur création filing: {str(e)}")
            continue
        discovered += 1
        
        # Parser le filing
        print(f"   📄 Parsing {accessionNumber}...")
        try:
            accession_no_dashes = accessionNumber.replace("-", "")
            cik_clean = cik.lstrip("0")
            xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_clean}/{accession_no_dashes}/infotable.xml"
            
            xml_response = requests.get(xml_url, headers={"User-Agent": "ADEL AI (contact@adel.ai)"}, timeout=30)
            xml_response.raise_for_status()
            
            holdings = parse_13f_file(xml_response.text)
            
            if holdings:
                for holding in holdings:
                    supabase.table("fund_holdings").insert({
                        "fund_id": fund_id,
                        "filing_id": filing_id,
                        "cik": cik,
                        "ticker": holding.get("ticker"),
                        "cusip": holding.get("cusip"),
                        "shares": holding.get("shares"),
                        "market_value": holding.get("market_value"),
                        "type": holding.get("type", "stock")
                    }).execute()
                
                supabase.table("fund_filings").update({
                    "status": "PARSED",
                    "updated_at": "now()"
                }).eq("id", filing_id).execute()
                
                print(f"      ✅ {len(holdings)} holdings parsés")
                parsed += 1
            else:
                print(f"      ⚠️  Aucun holding trouvé")
        except Exception as e:
            print(f"      ❌ Erreur parsing: {str(e)}")
            supabase.table("fund_filings").update({
                "status": "FAILED",
                "updated_at": "now()"
            }).eq("id", filing_id).execute()
    
    print("\n" + "="*70)
    print(f"✅ Terminé!")
    print(f"   Filings découverts: {discovered}")
    print(f"   Filings parsés: {parsed}")
    
    # Vérification finale
    holdings_count = supabase.table("fund_holdings").select("id").eq("cik", cik).execute()
    print(f"   Total holdings: {len(holdings_count.data) if holdings_count.data else 0}")

if __name__ == "__main__":
    main()

