#!/usr/bin/env python3
"""
Analyse complète et correcte de NVDA et PLTR pour Scion Asset Management
Distinction claire entre actions ordinaires et options PUT/CALL
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

def format_currency(value):
    """
    Formater une valeur en dollars
    NOTE: Les valeurs dans la DB sont en milliers de dollars
    Exemple: 186580 = 186,580 (milliers) = 186.58 millions USD
    Pour afficher en millions: diviser par 1000
    """
    # Convertir de milliers à millions pour l'affichage
    value_millions = value / 1000.0
    
    if value_millions >= 1000:
        return f"${value_millions/1000:.2f}B"  # Milliards
    else:
        return f"${value_millions:.2f}M"  # Millions

def analyze_ticker(supabase, fund_id, ticker_name, cusip, ticker_code):
    """Analyser un ticker spécifique (NVDA ou PLTR)"""
    print("="*80)
    print(f"📊 ANALYSE: {ticker_name} ({ticker_code})\n")
    
    # Récupérer tous les filings parsés
    filings_result = supabase.table("fund_filings")\
        .select("id, filing_date, accession_number")\
        .eq("fund_id", fund_id)\
        .eq("status", "PARSED")\
        .order("filing_date", desc=False)\
        .execute()
    
    filings = filings_result.data
    
    print(f"📅 Analyse sur {len(filings)} filings parsés\n")
    
    # Analyser chaque filing
    history = []
    
    for filing in filings:
        filing_id = filing["id"]
        filing_date = filing["filing_date"]
        accession = filing["accession_number"]
        
        # Récupérer TOUS les holdings (actions + options)
        holdings_result = supabase.table("fund_holdings")\
            .select("ticker, shares, market_value, type, cusip")\
            .eq("filing_id", filing_id)\
            .or_(f"ticker.ilike.%{ticker_code}%,cusip.eq.{cusip}")\
            .execute()
        
        if not holdings_result.data:
            history.append({
                "date": filing_date,
                "accession": accession,
                "stock_shares": 0,
                "stock_value": 0,
                "put_shares": 0,
                "put_value": 0,
                "call_shares": 0,
                "call_value": 0
            })
            continue
        
        # Séparer par type
        stock_shares = sum(h.get("shares", 0) for h in holdings_result.data if h.get("type") == "stock")
        stock_value = sum(h.get("market_value", 0) for h in holdings_result.data if h.get("type") == "stock")
        
        put_shares = sum(h.get("shares", 0) for h in holdings_result.data if h.get("type") == "put")
        put_value = sum(h.get("market_value", 0) for h in holdings_result.data if h.get("type") == "put")
        
        call_shares = sum(h.get("shares", 0) for h in holdings_result.data if h.get("type") == "call")
        call_value = sum(h.get("market_value", 0) for h in holdings_result.data if h.get("type") == "call")
        
        history.append({
            "date": filing_date,
            "accession": accession,
            "stock_shares": stock_shares,
            "stock_value": stock_value,
            "put_shares": put_shares,
            "put_value": put_value,
            "call_shares": call_shares,
            "call_value": call_value
        })
    
    # Afficher l'historique
    print("📈 Évolution trimestre par trimestre:\n")
    
    for i, h in enumerate(history):
        print(f"📅 {h['date']} ({h['accession']})")
        
        if h['stock_shares'] > 0:
            print(f"   ✅ Actions ordinaires: {h['stock_shares']:,} actions = {format_currency(h['stock_value'])}")
        else:
            print(f"   ❌ Actions ordinaires: Aucune")
        
        if h['put_shares'] > 0:
            print(f"   ⚠️  PUT Options: {h['put_shares']:,} contrats = {format_currency(h['put_value'])}")
        else:
            print(f"   ✅ PUT Options: Aucune")
        
        if h['call_shares'] > 0:
            print(f"   📞 CALL Options: {h['call_shares']:,} contrats = {format_currency(h['call_value'])}")
        
        # Comparer avec le trimestre précédent
        if i > 0:
            prev = history[i-1]
            print(f"\n   📊 Comparaison avec {prev['date']}:")
            
            # Actions
            if prev['stock_shares'] == 0 and h['stock_shares'] > 0:
                print(f"      🆕 NOUVELLE position actions: +{h['stock_shares']:,} actions")
            elif prev['stock_shares'] > 0 and h['stock_shares'] == 0:
                print(f"      🚨 SORTIE TOTALE actions: -{prev['stock_shares']:,} actions")
            elif prev['stock_shares'] > 0 and h['stock_shares'] > 0:
                change = h['stock_shares'] - prev['stock_shares']
                change_pct = (change / prev['stock_shares'] * 100) if prev['stock_shares'] > 0 else 0
                if change != 0:
                    print(f"      {'📈' if change > 0 else '📉'} Actions: {change:+,} ({change_pct:+.1f}%)")
            
            # PUTs
            if prev['put_shares'] == 0 and h['put_shares'] > 0:
                print(f"      ⚠️  NOUVEAUX PUTs: +{h['put_shares']:,} contrats (protection bearish)")
            elif prev['put_shares'] > 0 and h['put_shares'] == 0:
                print(f"      ✅ PUTs supprimés: -{prev['put_shares']:,} contrats")
            elif prev['put_shares'] > 0 and h['put_shares'] > 0:
                change = h['put_shares'] - prev['put_shares']
                change_pct = (change / prev['put_shares'] * 100) if prev['put_shares'] > 0 else 0
                if change != 0:
                    print(f"      {'⚠️' if change > 0 else '✅'} PUTs: {change:+,} ({change_pct:+.1f}%)")
        
        print()
    
    # Analyse finale
    print("="*80)
    print("🎯 INTERPRÉTATION FINALE:\n")
    
    latest = history[-1]
    
    # Vérifier la position actuelle
    has_stock = latest['stock_shares'] > 0
    has_put = latest['put_shares'] > 0
    has_call = latest['call_shares'] > 0
    
    if has_stock and not has_put and not has_call:
        print(f"✅ Position BULLISH pure")
        print(f"   ➡️  Scion détient {latest['stock_shares']:,} actions ordinaires")
        print(f"   ➡️  Signal: Confiance dans {ticker_name}")
        print(f"   ➡️  Valeur: {format_currency(latest['stock_value'])}")
    
    elif not has_stock and has_put and not has_call:
        print(f"🚨 Position BEARISH (protection)")
        print(f"   ➡️  Scion détient {latest['put_shares']:,} contrats PUT (pas d'actions)")
        print(f"   ➡️  Signal: Scion se PROTÈGE contre une baisse de {ticker_name}")
        print(f"   ➡️  Interprétation: Anticipation d'une baisse ou hedging d'une autre position")
        print(f"   ➡️  Valeur PUTs: {format_currency(latest['put_value'])}")
    
    elif has_stock and has_put:
        print(f"⚠️  Position HEDGED (actions + protection)")
        print(f"   ➡️  Actions: {latest['stock_shares']:,} actions = {format_currency(latest['stock_value'])}")
        print(f"   ➡️  PUTs: {latest['put_shares']:,} contrats = {format_currency(latest['put_value'])}")
        print(f"   ➡️  Signal: Scion est long mais se protège contre la baisse")
        print(f"   ➡️  Stratégie: Covered put ou protection de portefeuille")
    
    elif has_stock and has_call:
        print(f"📞 Position avec CALLs")
        print(f"   ➡️  Actions: {latest['stock_shares']:,} actions")
        print(f"   ➡️  CALLs: {latest['call_shares']:,} contrats")
        print(f"   ➡️  Signal: Potentiel bullish avec effet de levier")
    
    else:
        print(f"❌ Aucune position détectée")
    
    # Évolution
    if len(history) >= 2:
        prev = history[-2]
        print(f"\n📊 Évolution depuis {prev['date']}:")
        
        if prev['stock_shares'] == 0 and latest['stock_shares'] > 0:
            print(f"   🆕 NOUVELLE entrée en actions: +{latest['stock_shares']:,} actions")
        elif prev['stock_shares'] > 0 and latest['stock_shares'] == 0:
            print(f"   🚨 SORTIE TOTALE des actions")
        elif prev['stock_shares'] != latest['stock_shares']:
            change = latest['stock_shares'] - prev['stock_shares']
            change_pct = (change / prev['stock_shares'] * 100) if prev['stock_shares'] > 0 else 0
            print(f"   {'📈' if change > 0 else '📉'} Actions: {change:+,} ({change_pct:+.1f}%)")
        
        if prev['put_shares'] == 0 and latest['put_shares'] > 0:
            print(f"   ⚠️  NOUVEAUX PUTs: +{latest['put_shares']:,} contrats (protection ajoutée)")
        elif prev['put_shares'] > 0 and latest['put_shares'] == 0:
            print(f"   ✅ PUTs supprimés: protection retirée")
        elif prev['put_shares'] != latest['put_shares']:
            change = latest['put_shares'] - prev['put_shares']
            change_pct = (change / prev['put_shares'] * 100) if prev['put_shares'] > 0 else 0
            print(f"   {'⚠️' if change > 0 else '✅'} PUTs: {change:+,} ({change_pct:+.1f}%)")
    
    print("\n" + "="*80 + "\n")

def main():
    print("\n" + "="*80)
    print("🔍 ANALYSE COMPLÈTE - NVDA & PLTR")
    print("   Scion Asset Management, LLC")
    print("="*80 + "\n")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Récupérer le fund_id de Scion
    funds_result = supabase.table("funds")\
        .select("id, name")\
        .eq("name", "Scion Asset Management, LLC")\
        .execute()
    
    if not funds_result.data:
        print("❌ Scion Asset Management non trouvé")
        return
    
    fund_id = funds_result.data[0]["id"]
    
    # Analyser NVDA
    analyze_ticker(
        supabase, 
        fund_id, 
        "NVIDIA Corporation", 
        "67066G104", 
        "NVDA"
    )
    
    # Analyser PLTR
    analyze_ticker(
        supabase, 
        fund_id, 
        "Palantir Technologies", 
        "69608A108", 
        "PLTR"
    )
    
    # Résumé comparatif
    print("="*80)
    print("📋 RÉSUMÉ COMPARATIF\n")
    
    # Récupérer le dernier filing
    filing_result = supabase.table("fund_filings")\
        .select("id, filing_date")\
        .eq("fund_id", fund_id)\
        .eq("status", "PARSED")\
        .order("filing_date", desc=True)\
        .limit(1)\
        .execute()
    
    if filing_result.data:
        filing_id = filing_result.data[0]["id"]
        filing_date = filing_result.data[0]["filing_date"]
        
        print(f"📅 Dernier filing analysé: {filing_date}\n")
        
        # NVDA
        nvda_result = supabase.table("fund_holdings")\
            .select("type, shares, market_value")\
            .eq("filing_id", filing_id)\
            .or_("ticker.ilike.%NVDA%,cusip.eq.67066G104")\
            .execute()
        
        nvda_stock = sum(h.get("shares", 0) for h in nvda_result.data if h.get("type") == "stock")
        nvda_put = sum(h.get("shares", 0) for h in nvda_result.data if h.get("type") == "put")
        
        # PLTR
        pltr_result = supabase.table("fund_holdings")\
            .select("type, shares, market_value")\
            .eq("filing_id", filing_id)\
            .or_("ticker.ilike.%PLTR%,ticker.ilike.%PALANTIR%,cusip.eq.69608A108")\
            .execute()
        
        pltr_stock = sum(h.get("shares", 0) for h in pltr_result.data if h.get("type") == "stock")
        pltr_put = sum(h.get("shares", 0) for h in pltr_result.data if h.get("type") == "put")
        
        print("NVDA:")
        print(f"   Actions: {nvda_stock:,} | PUTs: {nvda_put:,}")
        print()
        print("PLTR:")
        print(f"   Actions: {pltr_stock:,} | PUTs: {pltr_put:,}")
        print()
        
        if nvda_put > 0 and nvda_stock == 0 and pltr_put > 0 and pltr_stock == 0:
            print("🎯 CONCLUSION GLOBALE:")
            print("   ➡️  Scion se PROTÈGE contre une baisse sur NVDA et PLTR")
            print("   ➡️  Stratégie: Hedging bearish (pas de positions longues)")
            print("   ➡️  Signal: Anticipation d'une correction ou protection de portefeuille")
    
    print("="*80 + "\n")

if __name__ == "__main__":
    main()

