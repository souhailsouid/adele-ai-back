#!/usr/bin/env python3
"""
Vérifier l'état des filings ARK et détecter les anomalies
"""

import os
from supabase import create_client, Client

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

def main():
    print("🔍 Vérification de l'état des filings ARK\n")
    print("="*70)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Vérifier les filings ARK
    print("📊 Filings ARK (CIK: 0001697748):\n")
    
    ark_filings = supabase.table("fund_filings")\
        .select("id, accession_number, filing_date, status, cik")\
        .eq("cik", "0001697748")\
        .order("filing_date", desc=True)\
        .execute()
    
    if not ark_filings.data:
        print("❌ Aucun filing ARK trouvé")
        return
    
    print(f"✅ {len(ark_filings.data)} filings ARK trouvés\n")
    
    # Grouper par statut
    by_status = {}
    for filing in ark_filings.data:
        status = filing.get("status", "UNKNOWN")
        if status not in by_status:
            by_status[status] = []
        by_status[status].append(filing)
    
    print("📋 Répartition par statut:\n")
    for status, filings in by_status.items():
        print(f"   {status}: {len(filings)} filings")
    
    print("\n" + "="*70)
    print("📄 Détails des filings ARK:\n")
    
    for filing in ark_filings.data:
        filing_id = filing["id"]
        status = filing.get("status", "UNKNOWN")
        date = filing.get("filing_date", "N/A")
        accession = filing.get("accession_number", "N/A")
        
        # Vérifier s'il y a des holdings
        holdings_result = supabase.table("fund_holdings")\
            .select("id")\
            .eq("filing_id", filing_id)\
            .limit(1)\
            .execute()
        
        has_holdings = len(holdings_result.data) > 0
        
        status_icon = "✅" if status == "PARSED" and has_holdings else "⚠️" if status == "PARSED" else "❌"
        
        print(f"{status_icon} Filing ID: {filing_id} | {date} | {status}")
        print(f"   Accession: {accession}")
        print(f"   Holdings: {'Oui' if has_holdings else 'Non'}")
        print()
    
    # 2. Vérifier les holdings ARK
    print("="*70)
    print("📊 Holdings ARK:\n")
    
    ark_holdings = supabase.table("fund_holdings")\
        .select("id, filing_id, ticker, shares, market_value, type, cik")\
        .eq("cik", "0001697748")\
        .execute()
    
    if ark_holdings.data:
        print(f"✅ {len(ark_holdings.data)} holdings ARK trouvés\n")
        for h in ark_holdings.data[:10]:  # Afficher les 10 premiers
            print(f"   {h.get('ticker', 'N/A')}: {h.get('shares', 0):,} actions = ${h.get('market_value', 0)/1000:.2f}M")
    else:
        print("❌ Aucun holding ARK trouvé")
        print("\n⚠️  ANOMALIE DÉTECTÉE:")
        print("   → Les filings ARK existent mais n'ont pas été parsés")
        print("   → Status: DISCOVERED (pas encore PARSED)")
        print("   → Solution: Parser les filings ARK")
    
    # 3. Comparer avec Scion
    print("\n" + "="*70)
    print("📊 Comparaison ARK vs Scion:\n")
    
    scion_filings = supabase.table("fund_filings")\
        .select("id, status")\
        .eq("cik", "0001649339")\
        .execute()
    
    scion_holdings = supabase.table("fund_holdings")\
        .select("id")\
        .eq("cik", "0001649339")\
        .execute()
    
    print("Scion (CIK: 0001649339):")
    print(f"   Filings: {len(scion_filings.data) if scion_filings.data else 0}")
    print(f"   Holdings: {len(scion_holdings.data) if scion_holdings.data else 0}")
    
    print("\nARK (CIK: 0001697748):")
    print(f"   Filings: {len(ark_filings.data)}")
    print(f"   Holdings: {len(ark_holdings.data) if ark_holdings.data else 0}")
    
    # 4. Détecter les anomalies
    print("\n" + "="*70)
    print("🔍 Détection d'anomalies:\n")
    
    anomalies = []
    
    # Anomalie 1: Filings sans holdings
    filings_without_holdings = []
    for filing in ark_filings.data:
        filing_id = filing["id"]
        holdings_check = supabase.table("fund_holdings")\
            .select("id")\
            .eq("filing_id", filing_id)\
            .limit(1)\
            .execute()
        if not holdings_check.data:
            filings_without_holdings.append(filing)
    
    if filings_without_holdings:
        anomalies.append({
            "type": "Filings sans holdings",
            "count": len(filings_without_holdings),
            "details": filings_without_holdings
        })
        print(f"⚠️  {len(filings_without_holdings)} filings ARK sans holdings")
        print("   → Ces filings doivent être parsés")
    
    # Anomalie 2: Filings avec status DISCOVERED mais pas parsés
    discovered_not_parsed = [f for f in ark_filings.data if f.get("status") == "DISCOVERED"]
    if discovered_not_parsed:
        anomalies.append({
            "type": "Filings DISCOVERED non parsés",
            "count": len(discovered_not_parsed),
            "details": discovered_not_parsed
        })
        print(f"⚠️  {len(discovered_not_parsed)} filings en status DISCOVERED")
        print("   → Le parser n'a pas encore été déclenché")
    
    # Anomalie 3: Filings avec status FAILED
    failed = [f for f in ark_filings.data if f.get("status") == "FAILED"]
    if failed:
        anomalies.append({
            "type": "Filings FAILED",
            "count": len(failed),
            "details": failed
        })
        print(f"❌ {len(failed)} filings en status FAILED")
        print("   → Le parsing a échoué, vérifier les logs")
    
    if not anomalies:
        print("✅ Aucune anomalie détectée")
    else:
        print(f"\n📋 Total: {len(anomalies)} type(s) d'anomalies détectées")
    
    # 5. Recommandations
    print("\n" + "="*70)
    print("💡 Recommandations:\n")
    
    if discovered_not_parsed:
        print("1. Parser les filings ARK non parsés:")
        print("   python3 scripts/parse-existing-filings.py")
        print("   (ou attendre que le parser Lambda se déclenche automatiquement)")
    
    if failed:
        print("2. Vérifier les logs du parser pour les filings FAILED")
        print("   → CloudWatch Logs: /aws/lambda/adel-ai-dev-parser-13f")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    main()

