#!/usr/bin/env python3
"""
Script pour parser directement un filing NVIDIA
"""

import sys
import os
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime

# Ajouter le chemin du parser
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../workers/parser-company-filing/src'))

FILING_URL = "https://www.sec.gov/ix?doc=/Archives/edgar/data/0001045810/000104581025000230/nvda-20251026.htm"

def extract_8k_items(soup: BeautifulSoup, document_url: str):
    """Extraire les items d'un 8-K"""
    events = []
    
    # Chercher les items 8-K (format: "Item X.XX")
    item_pattern = re.compile(r"Item\s+(\d+)\.(\d+)\s*[-–]\s*(.+)", re.IGNORECASE)
    
    # Chercher dans tout le texte
    text = soup.get_text()
    
    # Mapping des items 8-K vers les types d'événements
    item_mapping = {
        "2.02": {"type": "earnings", "importance": 9},
        "2.05": {"type": "earnings", "importance": 9},
        "8.01": {"type": "other_event", "importance": 5},
        "1.01": {"type": "agreement", "importance": 7},
        "1.02": {"type": "termination", "importance": 6},
        "2.01": {"type": "acquisition", "importance": 8},
        "5.02": {"type": "management_change", "importance": 7},
        "7.01": {"type": "regulation_fd", "importance": 4},
    }
    
    # Trouver tous les items
    for match in item_pattern.finditer(text):
        item_num = f"{match.group(1)}.{match.group(2)}"
        item_title = match.group(3).strip()
        
        # Déterminer le type d'événement
        event_info = item_mapping.get(item_num, {"type": "other_event", "importance": 5})
        
        # Extraire le contenu de l'item (texte suivant jusqu'au prochain item ou fin)
        start_pos = match.end()
        next_match = item_pattern.search(text, start_pos)
        end_pos = next_match.start() if next_match else len(text)
        item_content = text[start_pos:end_pos].strip()[:2000]  # Limiter à 2000 chars
        
        # Extraire la date si présente
        event_date = extract_date_from_text(item_content)
        
        # Créer un résumé (premiers 500 caractères)
        summary = item_content[:500] if len(item_content) > 500 else item_content
        
        events.append({
            "event_type": event_info["type"],
            "event_date": event_date,
            "title": f"8-K Item {item_num}: {item_title}",
            "summary": summary,
            "importance_score": event_info["importance"],
            "raw_data": {
                "item_number": item_num,
                "item_title": item_title,
                "content_preview": item_content[:1000]
            }
        })
    
    # Si aucun item trouvé, créer un événement générique
    if not events:
        events.append({
            "event_type": "other_event",
            "event_date": None,
            "title": "8-K Filing",
            "summary": text[:500] if len(text) > 500 else text,
            "importance_score": 5,
            "raw_data": {"content_preview": text[:1000]}
        })
    
    return events

def extract_date_from_text(text: str):
    """Extraire une date d'un texte"""
    patterns = [
        r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})",
        r"(\w+)\s+(\d{1,2}),\s+(\d{4})",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                return match.group(0)
            except:
                pass
    
    return None

def main():
    print(f"🔍 Parsing filing NVIDIA: {FILING_URL}")
    print("")
    
    # Télécharger le document
    headers = {
        "User-Agent": "ADEL AI (contact@adel.ai)"
    }
    
    print("📥 Téléchargement du document...")
    response = requests.get(FILING_URL, headers=headers, timeout=30)
    response.raise_for_status()
    
    print("✅ Document téléchargé")
    print("")
    
    # Parser le HTML
    soup = BeautifulSoup(response.content, "html.parser")
    
    # Extraire les items 8-K
    print("🔍 Extraction des items 8-K...")
    events = extract_8k_items(soup, FILING_URL)
    
    print(f"✅ {len(events)} événement(s) trouvé(s)")
    print("")
    
    # Afficher les événements
    for i, event in enumerate(events, 1):
        print(f"📋 Événement {i}:")
        print(f"   Type: {event['event_type']}")
        print(f"   Titre: {event['title']}")
        print(f"   Importance: {event['importance_score']}/10")
        print(f"   Date: {event['event_date'] or 'N/A'}")
        print(f"   Résumé: {event['summary'][:200]}...")
        print("")
    
    # Afficher un extrait du contenu pour vérification
    print("📄 Extrait du document (premiers 1000 caractères):")
    text = soup.get_text()
    print(text[:1000])
    print("...")

if __name__ == "__main__":
    main()







