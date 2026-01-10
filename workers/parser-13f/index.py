"""
Lambda Python pour parser les fichiers 13F EDGAR
Déclenché par EventBridge quand un nouveau 13F est découvert
"""

import json
import os
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Helper pour faire des requêtes Supabase directement (évite pydantic)
def supabase_request(method, table, data=None, filters=None):
    """Faire une requête HTTP directe vers Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Construire les query params pour les filtres (format PostgREST)
    params = []
    if filters:
        for k, v in filters.items():
            params.append(f"{k}=eq.{v}")
        if params:
            url += "?" + "&".join(params)
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    elif method == "PATCH":
        # Pour PATCH, les filtres doivent être dans l'URL
        response = requests.patch(url, headers=headers, json=data)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    response.raise_for_status()
    result = response.json() if response.text else None
    # Pour GET, retourner une liste même si un seul résultat
    if method == "GET" and result and not isinstance(result, list):
        return [result]
    return result

def fix_url_cik(url: str, correct_cik: str, correct_accession_no_dashes: str) -> str:
    """
    Corrige l'URL en remplaçant le CIK incorrect par le bon CIK.
    Les liens dans la page HTML peuvent pointer vers un CIK différent.
    Retourne une liste de deux URLs : une avec le CIK corrigé, une avec le CIK original (fallback).
    """
    if not url or not url.startswith("https://www.sec.gov/Archives/edgar/data/"):
        return url
    
    # Extraire le CIK de l'URL (format: /Archives/edgar/data/{cik}/...)
    parts = url.split("/Archives/edgar/data/")
    if len(parts) < 2:
        return url
    
    rest = parts[1]
    url_cik = rest.split("/")[0]
    
    # Si le CIK dans l'URL est différent, créer deux versions : corrigée et originale
    if url_cik != correct_cik:
        # Version corrigée avec le CIK du filing
        corrected_url = url.replace(f"/Archives/edgar/data/{url_cik}/", f"/Archives/edgar/data/{correct_cik}/")
        print(f"[DEBUG] Fixed URL CIK: {url_cik} -> {correct_cik} (will try both)")
        # Retourner la version corrigée en premier, mais garder l'originale comme fallback
        return corrected_url
    
    return url

def try_urls_with_fallback(urls: list, headers: dict, description: str = "") -> tuple:
    """
    Essaie plusieurs URLs et retourne la première qui fonctionne.
    Retourne (url, response_content) ou (None, None) si aucune ne fonctionne.
    """
    for url in urls:
        try:
            print(f"[DEBUG] Trying URL: {url} {description}")
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                # Vérifier que c'est du vrai XML avec informationTable
                if response.text.strip().startswith("<?xml") and "<!DOCTYPE html" not in response.text[:500]:
                    has_info_table = "informationTable" in response.text or "infoTable" in response.text
                    if has_info_table:
                        print(f"[DEBUG] SUCCESS: Found valid XML at: {url}")
                        return (url, response.text)
                    else:
                        print(f"[DEBUG] WARNING: XML found but no informationTable/infoTable: {url}")
                else:
                    print(f"[DEBUG] WARNING: Not valid XML or is HTML: {url}")
        except Exception as e:
            print(f"[DEBUG] ERROR trying {url}: {str(e)}")
            continue
    
    return (None, None)

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
        # Vérifier les variables d'environnement
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        
        # 1. Trouver dynamiquement le fichier XML depuis la page index
        # Le nom du fichier peut varier : Form13FInfoTable.xml, infotable.xml, etc.
        print(f"[DEBUG] Finding XML file for filing: {accession_number}")
        print(f"[DEBUG] Filing URL: {filing_url}")
        print(f"[DEBUG] CIK: {cik}")
        
        headers = {
            "User-Agent": "ADEL AI (contact@adel.ai)"
        }
        
        # Nettoyage des IDs AVANT tout
        accession_no_dashes = accession_number.replace("-", "")
        cik_clean = cik.lstrip("0") or "0"
        print(f"[DEBUG] Cleaned CIK: {cik_clean}, Accession (no dashes): {accession_no_dashes}")
        
        # PRIORITÉ 1: Lister directement les fichiers du répertoire EDGAR (plus fiable que parser l'index HTML)
        folder_url = f"https://www.sec.gov/Archives/edgar/data/{cik_clean}/{accession_no_dashes}/"
        print(f"[DEBUG] PRIORITE 1: Scanning folder: {folder_url}")
        
        xml_url = None
        
        try:
            print(f"[DEBUG] Fetching folder listing...")
            folder_resp = requests.get(folder_url, headers=headers, timeout=10)
            print(f"[DEBUG] Folder listing response: status={folder_resp.status_code}")
            
            if folder_resp.status_code == 200:
                folder_soup = BeautifulSoup(folder_resp.text, "html.parser")
                # Récupérer TOUS les liens finissant par .xml
                all_links = folder_soup.find_all("a", href=True)
                print(f"[DEBUG] Found {len(all_links)} total links in folder")
                
                xml_candidates = []
                for link in all_links:
                    href = link.get("href", "")
                    # FILTRE CRUCIAL : 
                    # 1. Doit être un XML
                    # 2. NE DOIT PAS être le document primaire (primary_doc.xml ou form13f.xml)
                    if href.endswith(".xml") and not any(x in href.lower() for x in ["primary_doc", "form13f"]):
                        xml_candidates.append(href)
                
                print(f"[DEBUG] Found {len(xml_candidates)} XML candidate(s) (excluding primary_doc/form13f): {xml_candidates}")
                
                for href in xml_candidates:
                    # Construire l'URL complète
                    if href.startswith("/"):
                        candidate_url = f"https://www.sec.gov{href}"
                    elif href.startswith("http"):
                        candidate_url = href
                    else:
                        candidate_url = f"{folder_url}{href}"
                    
                    # Vérification rapide du contenu pour confirmer que c'est l'Information Table
                    print(f"[DEBUG] Quick check: {href} -> {candidate_url}")
                    try:
                        check = requests.get(candidate_url, headers=headers, timeout=5)
                        print(f"[DEBUG] Check response: status={check.status_code}, size={len(check.text)} bytes")
                        if check.status_code == 200:
                            has_info_table = "informationTable" in check.text or "infoTable" in check.text
                            print(f"[DEBUG] Contains informationTable/infoTable: {has_info_table}")
                            if has_info_table:
                                xml_url = candidate_url
                                print(f"[DEBUG] SUCCESS: Found Information Table XML: {xml_url}")
                                break
                    except Exception as e:
                        print(f"[DEBUG] WARNING: Error checking {href}: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        continue
            else:
                print(f"[DEBUG] WARNING: Folder listing returned status {folder_resp.status_code}")
        except Exception as e:
            print(f"[DEBUG] WARNING: Could not access folder listing: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Si PRIORITÉ 1 a échoué, essayer de parser l'index HTML
        if not xml_url:
            print(f"[DEBUG] PRIORITE 1 failed, trying index page parsing...")
            # Parser la page index pour trouver le lien vers le fichier XML
            print(f"[DEBUG] Downloading index page: {filing_url}")
            index_response = requests.get(filing_url, headers=headers, timeout=30)
            index_response.raise_for_status()
            print(f"[DEBUG] Index page downloaded, size: {len(index_response.text)} bytes")
            
            # Chercher le lien vers le fichier XML dans la page HTML
            soup = BeautifulSoup(index_response.text, "html.parser")
            
            # Chercher les liens vers les fichiers XML (peuvent avoir différents noms)
            possible_names = ["Form13FInfoTable.xml", "infotable.xml", "InfoTable.xml", "form13finfotable.xml", "form13fInfoTable.xml", "Form13fInfoTable.xml"]
        
        # PRIORITÉ 2: Si pas trouvé, essayer les noms standards dans le répertoire racine
        if not xml_url:
            print(f"[DEBUG] PRIORITE 2: Trying standard XML filenames")
            for name in possible_names:
                # Exclure primary_doc.xml et form13f.xml (métadonnées, pas les holdings)
                if "primary_doc" in name.lower() or (name.lower() == "form13f.xml"):
                    continue
                    
                test_url = f"https://www.sec.gov/Archives/edgar/data/{cik_clean}/{accession_no_dashes}/{name}"
                try:
                    test_resp = requests.head(test_url, headers=headers, timeout=10)
                    if test_resp.status_code == 200:
                        content_check = requests.get(test_url, headers=headers, timeout=10)
                        if content_check.text.strip().startswith("<?xml") and "<!DOCTYPE html" not in content_check.text[:500]:
                            # Vérifier que le fichier contient bien les données 13F (informationTable)
                            if "informationTable" in content_check.text or "infoTable" in content_check.text:
                                xml_url = test_url
                                print(f"[DEBUG] SUCCESS: Found XML with standard name: {xml_url}")
                                break
                except:
                    continue
        
        # PRIORITÉ 3: Si pas trouvé, chercher dans les liens de la page index
        if not xml_url:
            # Extraire le répertoire de base depuis filing_url
            base_dir = "/".join(filing_url.split("/")[:-1])  # Enlever le nom du fichier index
            
            # Chercher dans les liens de la page
            for link in soup.find_all("a", href=True):
                href = link.get("href", "")
                # Exclure primary_doc.xml et form13f.xml (métadonnées, pas les holdings)
                if "primary_doc" in href.lower() or (href.lower().endswith("form13f.xml")):
                    continue
                    
                # Chercher un fichier XML qui correspond aux noms possibles
                for name in possible_names:
                    if name.lower() in href.lower() and href.endswith(".xml"):
                        # Construire l'URL complète
                        if href.startswith("http"):
                            candidate_url = href
                        elif href.startswith("/"):
                            candidate_url = f"https://www.sec.gov{href}"
                        else:
                            candidate_url = f"{base_dir}/{href}"
                        
                        # Corriger le CIK dans l'URL si nécessaire
                        candidate_url = fix_url_cik(candidate_url, cik_clean, accession_no_dashes)
                        
                        # Vérifier que ce n'est pas du HTML transformé ET qu'il contient les données 13F
                        try:
                            content_check = requests.get(candidate_url, headers=headers, timeout=10)
                            if content_check.text.strip().startswith("<?xml") and "<!DOCTYPE html" not in content_check.text[:500]:
                                # Vérifier que le fichier contient bien les données 13F (informationTable)
                                if "informationTable" in content_check.text or "infoTable" in content_check.text:
                                    xml_url = candidate_url
                                    print(f"[DEBUG] SUCCESS: Found XML in subdirectory: {xml_url}")
                                    break
                        except:
                            continue
                if xml_url:
                    break
        
        # PRIORITÉ 4: Chercher tous les fichiers XML dans la page et trouver celui de type "INFORMATION TABLE"
        if not xml_url:
            base_dir = "/".join(filing_url.split("/")[:-1])
            print(f"[DEBUG] PRIORITE 4: Searching for INFORMATION TABLE in HTML tables, base_dir={base_dir}")
            
            # Parser le tableau HTML pour trouver les fichiers XML de type "INFORMATION TABLE"
            # La structure EDGAR a un tableau avec Seq, Description, Document, Type, Size
            tables = soup.find_all("table")
            print(f"[DEBUG] Found {len(tables)} table(s) in the page")
            
            for table_idx, table in enumerate(tables):
                rows = table.find_all("tr")
                print(f"Table {table_idx}: Found {len(rows)} row(s)")
                
                # Chercher l'en-tête du tableau pour identifier les colonnes
                header_row = None
                header_cols = []
                for row in rows:
                    header_cells = row.find_all(["th", "td"])
                    if len(header_cells) > 0:
                        header_text = " ".join([cell.get_text(strip=True).upper() for cell in header_cells])
                        if "DOCUMENT" in header_text and "TYPE" in header_text:
                            header_row = row
                            header_cols = [cell.get_text(strip=True).upper() for cell in header_cells]
                            print(f"[DEBUG] Found table header: {header_cols}")
                            break
                
                # Parser les lignes de données
                for row_idx, row in enumerate(rows):
                    cells = row.find_all("td")
                    if len(cells) < 2:  # Au moins 2 cellules (Document et Type)
                        continue
                    
                    # Chercher les liens XML dans cette ligne
                    xml_links = row.find_all("a", href=True)
                    xml_link = None
                    
                    # Trouver le lien XML (exclure primary_doc.xml et form13f.xml)
                    for link in xml_links:
                        href = link.get("href", "")
                        if href.endswith(".xml") and "primary_doc" not in href.lower() and not href.lower().endswith("form13f.xml"):
                            xml_link = href
                            break
                    
                    if not xml_link:
                        continue
                    
                    # Chercher le texte "INFORMATION TABLE" dans les cellules de la ligne
                    # Le Type est généralement dans une des colonnes
                    row_text = row.get_text().upper()
                    is_information_table = "INFORMATION TABLE" in row_text or "INFOTABLE" in row_text
                    has_infotable_name = "infotable" in xml_link.lower()
                    
                    # Vérifier aussi dans les cellules individuelles (le Type peut être dans une colonne spécifique)
                    type_cell_text = ""
                    for cell in cells:
                        cell_text = cell.get_text(strip=True).upper()
                        if "INFORMATION TABLE" in cell_text or "INFOTABLE" in cell_text:
                            type_cell_text = cell_text
                            is_information_table = True
                            break
                    
                    if (is_information_table or has_infotable_name) and xml_link:
                        print(f"Row {row_idx}: Found XML link {xml_link}, is_info_table={is_information_table}, has_infotable_name={has_infotable_name}, type_cell='{type_cell_text}'")
                        
                        # Construire l'URL complète
                        if xml_link.startswith("http"):
                            candidate_url_original = xml_link
                        elif xml_link.startswith("/"):
                            candidate_url_original = f"https://www.sec.gov{xml_link}"
                        else:
                            candidate_url_original = f"{base_dir}/{xml_link}"
                        
                        # Essayer les deux CIKs : d'abord l'URL originale (qui fonctionne souvent), puis la corrigée
                        candidate_url_corrected = fix_url_cik(candidate_url_original, cik_clean, accession_no_dashes)
                        urls_to_try = [candidate_url_original]  # Essayer d'abord l'URL originale (CIK du lien HTML)
                        if candidate_url_corrected != candidate_url_original:
                            urls_to_try.append(candidate_url_corrected)  # Puis essayer avec le CIK corrigé
                        
                        # Essayer chaque URL
                        for candidate_url in urls_to_try:
                            print(f"[DEBUG] Testing candidate URL: {candidate_url}")
                            try:
                                content_check = requests.get(candidate_url, headers=headers, timeout=10)
                                if content_check.status_code == 200:
                                    content_text = content_check.text.strip()
                                    # Accepter XML qui commence par <?xml OU directement par une balise XML (<informationTable>, <infoTable>, etc.)
                                    is_xml = (content_text.startswith("<?xml") or 
                                             content_text.startswith("<informationTable") or 
                                             content_text.startswith("<infoTable") or
                                             content_text.startswith("<") and "<!DOCTYPE html" not in content_text[:500])
                                    
                                    if is_xml:
                                        # Vérifier que le fichier contient bien les données 13F (informationTable ou infoTable)
                                        has_info_table = "informationTable" in content_text or "infoTable" in content_text
                                        if has_info_table:
                                            xml_url = candidate_url
                                            print(f"[DEBUG] SUCCESS: Found XML INFORMATION TABLE: {xml_url}")
                                            break
                                        else:
                                            print(f"[DEBUG] WARNING: XML file found but doesn't contain informationTable/infoTable")
                                    else:
                                        print(f"[DEBUG] WARNING: File is not valid XML or is HTML (status: {content_check.status_code})")
                                else:
                                    print(f"[DEBUG] WARNING: HTTP error (status: {content_check.status_code})")
                            except Exception as e:
                                print(f"[DEBUG] ERROR: Error checking candidate URL {candidate_url}: {str(e)}")
                                continue
                        
                        if xml_url:
                            break
                
                if xml_url:
                    break
        
        # PRIORITÉ 5: Si toujours pas trouvé, chercher tous les fichiers .xml dans la page et tester le premier qui ressemble à un fichier 13F
        if not xml_url:
            base_dir = "/".join(filing_url.split("/")[:-1])
            print(f"[DEBUG] PRIORITE 5: Scanning all XML links in page, base_dir={base_dir}")
            all_xml_links = []
            
            for link in soup.find_all("a", href=True):
                href = link.get("href", "")
                # Exclure primary_doc.xml et form13f.xml (métadonnées, pas les holdings)
                if href.endswith(".xml") and "primary_doc" not in href.lower() and not href.lower().endswith("form13f.xml"):
                    if href.startswith("http"):
                        candidate_url_original = href
                    elif href.startswith("/"):
                        candidate_url_original = f"https://www.sec.gov{href}"
                    else:
                        candidate_url_original = f"{base_dir}/{href}"
                    
                    # Essayer les deux CIKs : d'abord l'URL originale (qui fonctionne souvent), puis la corrigée
                    candidate_url_corrected = fix_url_cik(candidate_url_original, cik_clean, accession_no_dashes)
                    all_xml_links.append(candidate_url_original)  # Essayer d'abord l'URL originale (CIK du lien HTML)
                    if candidate_url_corrected != candidate_url_original:
                        all_xml_links.append(candidate_url_corrected)  # Puis essayer avec le CIK corrigé
            
            print(f"[DEBUG] Found {len(all_xml_links)} total XML links to test: {all_xml_links[:3]}...")  # Afficher les 3 premiers
            
            # Tester chaque fichier XML pour voir s'il contient des données 13F
            for idx, candidate_url in enumerate(all_xml_links):
                print(f"[DEBUG] Testing XML link {idx+1}/{len(all_xml_links)}: {candidate_url.split('/')[-1]}")
                try:
                    content_check = requests.get(candidate_url, headers=headers, timeout=10)
                    if content_check.status_code == 200:
                        content_text = content_check.text.strip()
                        # Accepter XML qui commence par <?xml OU directement par une balise XML (<informationTable>, <infoTable>, etc.)
                        is_xml = (content_text.startswith("<?xml") or 
                                 content_text.startswith("<informationTable") or 
                                 content_text.startswith("<infoTable") or
                                 content_text.startswith("<") and "<!DOCTYPE html" not in content_text[:500])
                        
                        if is_xml:
                            # Vérifier que le fichier contient bien les données 13F (informationTable ou infoTable)
                            has_info_table = "informationTable" in content_text or "infoTable" in content_text
                            if has_info_table:
                                xml_url = candidate_url
                                print(f"[DEBUG] SUCCESS: Found XML by scanning all links: {xml_url}")
                                break
                            else:
                                print(f"[DEBUG] WARNING: XML file found but doesn't contain informationTable/infoTable: {candidate_url.split('/')[-1]}")
                        else:
                            print(f"[DEBUG] WARNING: File is not valid XML or is HTML")
                except Exception as e:
                    print(f"[DEBUG] ERROR: Exception testing {candidate_url}: {str(e)}")
                    continue
        
        if not xml_url:
            # Log final pour debug
            print(f"[DEBUG] ERROR: Could not find XML file after all attempts")
            print(f"[DEBUG]    Filing URL: {filing_url}")
            print(f"[DEBUG]    CIK: {cik} (cleaned: {cik_clean})")
            print(f"[DEBUG]    Accession: {accession_number} (no dashes: {accession_no_dashes})")
            print(f"[DEBUG]    Folder URL: {folder_url}")
            print(f"[DEBUG]    Base dir: {base_dir if 'base_dir' in locals() else 'N/A'}")
            print(f"[DEBUG]    Total XML links found: {len(all_xml_links) if 'all_xml_links' in locals() else 0}")
            raise ValueError(f"Could not find XML file for filing {accession_number}")
        
        print(f"[DEBUG] SUCCESS: Found XML file: {xml_url}")
        
        # 2. Télécharger le fichier XML (avec timeout plus long pour gros fichiers)
        response = requests.get(xml_url, headers=headers, timeout=120, stream=True)
        response.raise_for_status()
        
        # 3. Récupérer le filing_id (depuis l'event ou depuis la DB)
        filing_id = detail.get("filing_id")
        if not filing_id:
            # Fallback: récupérer depuis la DB via API REST
            filing_result = supabase_request("GET", "fund_filings", filters={"accession_number": accession_number})
            if filing_result and len(filing_result) > 0:
                filing_id = filing_result[0]["id"]
            else:
                raise ValueError(f"Filing not found for accession_number: {accession_number}")
        
        # 4. Parser le XML (utiliser response.content avec gestion d'encodage)
        # Détecter l'encodage depuis les headers ou le XML
        content = response.content
        # Essayer de décoder en UTF-8, sinon utiliser l'encodage détecté
        try:
            content_str = content.decode('utf-8', errors='replace')
        except:
            # Si UTF-8 échoue, essayer latin-1 (qui peut décoder n'importe quel byte)
            content_str = content.decode('latin-1', errors='replace')
        
        holdings = parse_13f_file(content_str, xml_url)
        
        # 5. Extraire period_of_report depuis le XML (si disponible)
        period_of_report = None
        try:
            # Chercher periodOfReport dans le XML
            root = ET.fromstring(content_str)
            for elem in root.iter():
                localname = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                if localname.lower() in ['periodofreport', 'period_of_report', 'reportdate', 'report_date']:
                    period_text = elem.text
                    if period_text:
                        # Parser la date (format peut varier: YYYY-MM-DD, YYYYMMDD, etc.)
                        try:
                            from datetime import datetime
                            # Essayer différents formats
                            for fmt in ['%Y-%m-%d', '%Y%m%d', '%Y-%m-%dT%H:%M:%S']:
                                try:
                                    period_of_report = datetime.strptime(period_text.strip()[:10], fmt).date().isoformat()
                                    break
                                except:
                                    continue
                        except:
                            pass
                    break
        except Exception as e:
            print(f"Could not extract period_of_report: {str(e)}")
        
        # 6. Insérer les holdings
        for holding in holdings:
            supabase_request("POST", "fund_holdings", data={
                "fund_id": fund_id,
                "filing_id": filing_id,
                "cik": cik,
                "ticker": holding.get("ticker"),
                "cusip": holding.get("cusip"),
                "shares": holding.get("shares"),
                "market_value": holding.get("market_value"),
                "type": holding.get("type", "stock")
            })
        
        # 7. Mettre à jour le statut et les métadonnées
        update_data = {
            "status": "PARSED",
            "updated_at": "now()"
        }
        if period_of_report:
            update_data["period_of_report"] = period_of_report
        if xml_url:
            update_data["raw_storage_path"] = xml_url  # Stocker l'URL du XML comme référence
        
        supabase_request("PATCH", "fund_filings", 
            data=update_data,
            filters={"id": filing_id}
        )
        
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
            supabase_request("PATCH", "fund_filings",
                data={"status": "FAILED", "updated_at": "now()"},
                filters={"accession_number": accession_number}
            )
        except:
            pass
        
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


def parse_13f_file(content: str, url: str) -> list:
    """
    Parse un fichier 13F XML et extrait les holdings
    Solution universelle qui détecte automatiquement le format et utilise le parser adapté
    """
    holdings = []
    
    try:
        # Vérifier si c'est du HTML transformé ou du XML brut
        is_html = "<!DOCTYPE html" in content[:500] or content.strip().startswith("<html")
        
        if is_html:
            # C'est du HTML transformé, utiliser BeautifulSoup
            print("Warning: Received HTML instead of XML, trying to parse as HTML...")
            soup = BeautifulSoup(content, "html.parser")
            info_tables = soup.find_all("table", class_=lambda x: x and "infotable" in str(x).lower())
            if not info_tables:
                all_tables = soup.find_all("table")
                info_tables = [t for t in all_tables if t.find("tr") and len(t.find_all("tr")) > 2]
            
            print(f"Found {len(info_tables)} holdings in HTML")
            return parse_holdings_from_beautifulsoup(info_tables)
        else:
            # C'est du XML brut - utiliser xml.etree.ElementTree (plus rapide) en priorité
            # Fallback sur BeautifulSoup si nécessaire
            print("Parsing XML file...")
            
            # MÉTHODE 1: xml.etree.ElementTree (rapide, gère bien les namespaces)
            try:
                # Parser avec ET (ignore les namespaces automatiquement)
                root = ET.fromstring(content)
                
                # Chercher tous les infoTable (ignore les namespaces)
                # ET utilise {namespace}localname, mais on peut chercher par localname seulement
                info_tables = []
                for elem in root.iter():
                    # Extraire le nom local (sans namespace)
                    localname = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                    if localname.lower() == 'infotable':
                        info_tables.append(elem)
                
                if info_tables:
                    print(f"Method 1 (xml.etree.ElementTree): Found {len(info_tables)} infoTable elements")
                    return parse_holdings_from_etree(info_tables)
            except Exception as e:
                print(f"Method 1 (ET) failed: {str(e)}, trying BeautifulSoup...")
            
            # MÉTHODE 2: BeautifulSoup (fallback, plus lent mais plus tolérant)
            try:
                soup = BeautifulSoup(content, "html.parser")
                
                # Chercher toutes les balises et filtrer par nom (ignore les namespaces)
                all_elements = soup.find_all(True, recursive=True)
                info_tables = [t for t in all_elements if t.name and t.name.lower() == "infotable"]
                
                if not info_tables:
                    info_tables = soup.find_all(["infoTable", "InfoTable", "infotable"])
                
                if not info_tables:
                    info_table_parent = soup.find("informationTable")
                    if info_table_parent:
                        info_tables = info_table_parent.find_all("infoTable", recursive=True)
                
                if info_tables:
                    print(f"Method 2 (BeautifulSoup): Found {len(info_tables)} infoTable elements")
                    return parse_holdings_from_beautifulsoup(info_tables)
            except Exception as e:
                print(f"Method 2 (BeautifulSoup) failed: {str(e)}")
                raise
        
        # Si aucune méthode n'a fonctionné
        print("No holdings found with any parsing method")
        return []
        
    except Exception as e:
        print(f"Error parsing XML: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


def parse_holdings_from_etree(info_tables) -> list:
    """
    Parse les holdings depuis des éléments xml.etree.ElementTree
    """
    holdings = []
    
    for table in info_tables:
        # Helper pour trouver un tag en ignorant le namespace ET le préfixe
        def find_tag(element, tag_name):
            """Trouve un élément enfant par son nom local (ignore namespace)"""
            for child in element:
                # Retirer le namespace (ex: {http://...}infoTable -> infoTable)
                # ou ns4:infoTable -> infoTable (géré par split('}'))
                local = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if local.lower() == tag_name.lower():
                    return child
            return None
        
        def get_text(element, tag_name):
            """Extrait le texte d'un élément enfant"""
            elem = find_tag(element, tag_name)
            return elem.text.strip() if elem is not None and elem.text else ""
        
        # Extraction des données (gère les namespaces ns4:, etc.)
        name_elem = find_tag(table, "nameOfIssuer")
        name = name_elem.text.strip() if name_elem is not None and name_elem.text else ""
        
        cusip_elem = find_tag(table, "cusip")
        cusip = cusip_elem.text.strip() if cusip_elem is not None and cusip_elem.text else ""
        
        value_elem = find_tag(table, "value")
        value_text = value_elem.text.strip() if value_elem is not None and value_elem.text else "0"
        
        # Gestion de la structure imbriquée shrsOrPrnAmt -> sshPrnamt
        shares = "0"
        shrs_amt_elem = find_tag(table, "shrsOrPrnAmt")
        if shrs_amt_elem is not None:
            ssh_elem = find_tag(shrs_amt_elem, "sshPrnamt")
            if ssh_elem is not None and ssh_elem.text:
                shares = ssh_elem.text.strip()
        
        # Type de position (Put/Call/Stock)
        pc_elem = find_tag(table, "putCall")
        put_call = pc_elem.text.upper().strip() if pc_elem is not None and pc_elem.text else ""
        
        # Valeurs numériques
        try:
            value = int(float(value_text.replace(",", ""))) if value_text else 0
            shares_int = int(float(shares.replace(",", ""))) if shares else 0
            
            # Détecter le format (dollars vs milliers)
            if value > 1_000_000 and shares_int > 0:
                price_if_thousands = (value * 1000) / shares_int
                if price_if_thousands > 1000:
                    value_usd = value // 1000
                else:
                    value_usd = value
            else:
                value_usd = value
        except Exception as e:
            print(f"[DEBUG] WARNING: Error parsing numeric values: {str(e)}")
            value_usd = 0
            shares_int = 0
        
        # Type de position
        holding_type = "put" if "PUT" in put_call else ("call" if "CALL" in put_call else "stock")
        
        # Ticker
        ticker = extract_ticker(name)
        
        holdings.append({
            "ticker": ticker,
            "cusip": cusip,
            "shares": shares_int,
            "market_value": value_usd,
            "type": holding_type
        })
    
    return holdings


def parse_holdings_from_beautifulsoup(info_tables) -> list:
    """
    Parse les holdings depuis des éléments BeautifulSoup
    """
    holdings = []
    
    for table in info_tables:
            # Extraire les champs (camelCase dans le XML) - chercher avec différentes casses
            name_elem = (table.find("nameofissuer") or table.find("nameOfIssuer") or 
                        table.find("n1:nameofissuer") or table.find("n1:nameOfIssuer"))
            cusip_elem = (table.find("cusip") or table.find("CUSIP") or 
                         table.find("n1:cusip") or table.find("n1:CUSIP"))
            value_elem = (table.find("value") or table.find("Value") or 
                         table.find("n1:value") or table.find("n1:Value"))
            
            # Shares: <shrsOrPrnAmt><sshPrnamt>...</sshPrnamt></shrsOrPrnAmt>
            shrs_elem = (table.find("shrsorprnamt") or table.find("shrsOrPrnAmt") or 
                        table.find("n1:shrsorprnamt") or table.find("n1:shrsOrPrnAmt"))
            if shrs_elem:
                ssh_prnamt_elem = (shrs_elem.find("sshprnamt") or shrs_elem.find("sshPrnamt") or 
                                  shrs_elem.find("n1:sshprnamt") or shrs_elem.find("n1:sshPrnamt"))
            else:
                ssh_prnamt_elem = None
            
            put_call_elem = (table.find("putcall") or table.find("putCall") or 
                           table.find("n1:putcall") or table.find("n1:putCall"))
            
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
    
    return holdings


def extract_ticker(name: str) -> str:
    """
    Extraire le ticker depuis le nom (approximation)
    En production, utiliser un mapping CUSIP → Ticker
    """
    # TODO: Implémenter mapping CUSIP → Ticker
    # Pour l'instant, retourner le nom tel quel
    return name.upper()[:10] if name else ""

