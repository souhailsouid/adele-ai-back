#!/usr/bin/env python3
"""
Script pour ajouter ARK Investment Management LLC (Cathie Wood) à la liste des funds surveillés
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client

# Charger .env depuis la racine du projet si disponible
try:
    from dotenv import load_dotenv
    # Chercher .env à la racine du projet (2 niveaux au-dessus de scripts/)
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # dotenv optionnel

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

def main():
    print("📊 Ajout d'ARK Investment Management LLC (Cathie Wood)\n")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Vérifier si ARK existe déjà
    existing = supabase.table("funds")\
        .select("id, name, cik")\
        .or_("cik.eq.0001697748,cik.eq.1697748")\
        .execute()
    
    if existing.data:
        print(f"⚠️  ARK existe déjà dans la base:")
        for fund in existing.data:
            print(f"   ID: {fund['id']} | Name: {fund['name']} | CIK: {fund['cik']}")
        print("\n✅ Pas besoin d'ajouter, déjà présent!")
        return
    
    # Ajouter ARK Investment Management LLC
    print("➕ Ajout d'ARK Investment Management LLC...")
    print("   CIK: 0001697748")
    print("   Name: ARK Investment Management LLC")
    print("   Tier: 5 (très haute influence - Cathie Wood)")
    print("   Category: hedge_fund\n")
    
    result = supabase.table("funds")\
        .insert({
            "name": "ARK Investment Management LLC",
            "cik": "0001697748",
            "tier_influence": 5,  # Très haute influence (Cathie Wood)
            "category": "hedge_fund"
        })\
        .execute()
    
    if result.data:
        fund = result.data[0]
        print("✅ ARK Investment Management LLC ajouté avec succès!")
        print(f"   ID: {fund['id']}")
        print(f"   Name: {fund['name']}")
        print(f"   CIK: {fund['cik']}")
        print(f"   Tier: {fund['tier_influence']}")
        print(f"   Category: {fund['category']}")
        print("\n📡 Le collector-sec-watcher va maintenant surveiller ARK automatiquement!")
        print("   Prochaine vérification: dans 5 minutes (cron EventBridge)")
    else:
        print("❌ Erreur lors de l'ajout")
    
    # Afficher tous les funds surveillés
    print("\n" + "="*60)
    print("📋 Tous les funds surveillés:\n")
    
    all_funds = supabase.table("funds")\
        .select("id, name, cik, tier_influence, category")\
        .order("tier_influence", desc=True)\
        .execute()
    
    for fund in all_funds.data:
        print(f"   {fund['id']}. {fund['name']}")
        print(f"      CIK: {fund['cik']} | Tier: {fund['tier_influence']} | Category: {fund.get('category', 'N/A')}")
        print()

if __name__ == "__main__":
    main()

