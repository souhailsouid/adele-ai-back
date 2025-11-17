#!/usr/bin/env python3
"""
Analyser l'évolution des positions ARK sur Tesla, Palantir et Coinbase
"""

import os
from supabase import create_client, Client
from collections import defaultdict

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
    """Formater une valeur en millions/milliards
    NOTE: value est en milliers dans la DB
    """
    value_millions = value / 1000.0  # Convertir milliers → millions
    if value_millions >= 1000:
        return f"${value_millions/1000:.2f}B"
    else:
        return f"${value_millions:.2f}M"

def main():
    print("🔍 Analyse des positions ARK: Tesla, Palantir, Coinbase\n")
    print("="*80)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Tickers à analyser
    tickers = ["TESLA", "PALANTIR", "COINBASE"]
    
    # Récupérer tous les filings ARK par date
    filings = supabase.table("fund_filings")\
        .select("id, filing_date")\
        .eq("cik", "0001697748")\
        .order("filing_date", desc=False)\
        .execute()
    
    if not filings.data:
        print("❌ Aucun filing ARK trouvé")
        return
    
    print(f"📅 {len(filings.data)} filings analysés\n")
    
    # Pour chaque ticker, analyser l'évolution
    for ticker in tickers:
        print(f"\n{'='*80}")
        print(f"📊 {ticker}\n")
        
        positions = []
        
        for filing in filings.data:
            filing_id = filing["id"]
            filing_date = filing["filing_date"]
            
            # Chercher les holdings pour ce ticker dans ce filing
            holdings = supabase.table("fund_holdings")\
                .select("ticker, shares, market_value, type")\
                .eq("filing_id", filing_id)\
                .eq("type", "stock")\
                .or_(f"ticker.ilike.%{ticker}%,cusip.ilike.%{ticker}%")\
                .execute()
            
            if holdings.data:
                # Somme des positions (peut y avoir plusieurs lignes)
                total_shares = sum(h.get("shares", 0) for h in holdings.data)
                total_value = sum(h.get("market_value", 0) for h in holdings.data)
                
                positions.append({
                    "date": filing_date,
                    "shares": total_shares,
                    "value": total_value,
                    "value_formatted": format_currency(total_value)
                })
        
        if not positions:
            print(f"   ❌ Aucune position trouvée pour {ticker}")
            continue
        
        # Afficher l'évolution
        print(f"   Date       | Actions      | Valeur")
        print(f"   {'-'*70}")
        
        prev_shares = None
        prev_value = None
        
        for pos in positions:
            date = pos["date"]
            shares = pos["shares"]
            value = pos["value"]
            value_fmt = pos["value_formatted"]
            
            # Calculer la variation
            if prev_shares is not None:
                shares_diff = shares - prev_shares
                shares_pct = ((shares - prev_shares) / prev_shares * 100) if prev_shares > 0 else 0
                value_diff = value - prev_value
                value_pct = ((value - prev_value) / prev_value * 100) if prev_value > 0 else 0
                
                shares_icon = "📈" if shares_diff > 0 else "📉" if shares_diff < 0 else "➡️"
                value_icon = "📈" if value_diff > 0 else "📉" if value_diff < 0 else "➡️"
                
                shares_str = f"{shares_icon} {shares_diff:+,} ({shares_pct:+.1f}%)"
                value_str = f"{value_icon} {value_diff/1000:+,.0f}K ({value_pct:+.1f}%)"
            else:
                shares_str = ""
                value_str = ""
            
            print(f"   {date} | {shares:>12,} | {value_fmt:>10} {shares_str}")
            if prev_shares is not None:
                print(f"   {' '*11} | {' '*12} | {' '*10} {value_str}")
            
            prev_shares = shares
            prev_value = value
        
        # Résumé
        if len(positions) > 1:
            first = positions[0]
            last = positions[-1]
            
            shares_change = last["shares"] - first["shares"]
            shares_pct = ((last["shares"] - first["shares"]) / first["shares"] * 100) if first["shares"] > 0 else 0
            value_change = last["value"] - first["value"]
            value_pct = ((last["value"] - first["value"]) / first["value"] * 100) if first["value"] > 0 else 0
            
            print(f"\n   📊 Évolution totale:")
            print(f"      Actions: {shares_change:+,} ({shares_pct:+.1f}%)")
            print(f"      Valeur: {format_currency(abs(value_change))} ({value_pct:+.1f}%)")
            
            if shares_change > 0:
                print(f"      → ARK a AUGMENTÉ sa position sur {ticker}")
            elif shares_change < 0:
                print(f"      → ARK a RÉDUIT sa position sur {ticker}")
            else:
                print(f"      → Position stable sur {ticker}")
    
    print(f"\n{'='*80}")
    print("✅ Analyse terminée!")

if __name__ == "__main__":
    main()

