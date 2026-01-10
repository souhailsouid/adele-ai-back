# Routes FMP API
# DÉSACTIVÉES TEMPORAIREMENT POUR RÉDUIRE LA CHARGE SUR LA LAMBDA
# Toutes les routes FMP sont commentées pour éviter le throttling

# Quote
# resource "aws_apigatewayv2_route" "get_fmp_quote" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/quote/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Financial Statements Routes ==========

# Income Statement
#resource "aws_apigatewayv2_route" "get_fmp_income_statement" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/income-statement/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Income Statement TTM
#resource "aws_apigatewayv2_route" "get_fmp_income_statement_ttm" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/income-statement-ttm/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Balance Sheet Statement
#resource "aws_apigatewayv2_route" "get_fmp_balance_sheet_statement" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/balance-sheet-statement/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Balance Sheet Statement TTM
#resource "aws_apigatewayv2_route" "get_fmp_balance_sheet_statement_ttm" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/balance-sheet-statement-ttm/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Cash Flow Statement
#resource "aws_apigatewayv2_route" "get_fmp_cash_flow_statement" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/cash-flow-statement/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Cash Flow Statement TTM
#resource "aws_apigatewayv2_route" "get_fmp_cash_flow_statement_ttm" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/cash-flow-statement-ttm/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Latest Financial Statements
# need subscription
# resource "aws_apigatewayv2_route" "get_fmp_latest_financial_statements" {
#   api_id             = aws_apigatewayv2_api.http_data.id
#   route_key          = "GET /fmp/latest-financial-statements"
#   target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
# }

# Key Metrics
#resource "aws_apigatewayv2_route" "get_fmp_key_metrics" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/key-metrics/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Key Metrics TTM
#resource "aws_apigatewayv2_route" "get_fmp_key_metrics_ttm" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/key-metrics-ttm/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Ratios
#resource "aws_apigatewayv2_route" "get_fmp_financial_ratios" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-ratios/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Scores
#resource "aws_apigatewayv2_route" "get_fmp_financial_scores" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-scores/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Owner Earnings
#resource "aws_apigatewayv2_route" "get_fmp_owner_earnings" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/owner-earnings/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Enterprise Values
#resource "aws_apigatewayv2_route" "get_fmp_enterprise_values" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/enterprise-values/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Income Statement Growth
#resource "aws_apigatewayv2_route" "get_fmp_income_statement_growth" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/income-statement-growth/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Balance Sheet Statement Growth
#resource "aws_apigatewayv2_route" "get_fmp_balance_sheet_statement_growth" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/balance-sheet-statement-growth/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Cashflow Statement Growth
#resource "aws_apigatewayv2_route" "get_fmp_cash_flow_statement_growth" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/cash-flow-statement-growth/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Statement Growth
#resource "aws_apigatewayv2_route" "get_fmp_financial_growth" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-growth/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Reports Dates
#resource "aws_apigatewayv2_route" "get_fmp_financial_reports_dates" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-reports-dates/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Reports Form 10-K JSON
#resource "aws_apigatewayv2_route" "get_fmp_financial_reports_json" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-reports-json/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Financial Reports Form 10-K XLSX
#resource "aws_apigatewayv2_route" "get_fmp_financial_reports_xlsx" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-reports-xlsx/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Revenue Product Segmentation
#resource "aws_apigatewayv2_route" "get_fmp_revenue_product_segmentation" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/revenue-product-segmentation/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Revenue Geographic Segments
#resource "aws_apigatewayv2_route" "get_fmp_revenue_geographic_segmentation" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/revenue-geographic-segmentation/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# As Reported Income Statements
#resource "aws_apigatewayv2_route" "get_fmp_income_statement_as_reported" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/income-statement-as-reported/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# As Reported Balance Statements
#resource "aws_apigatewayv2_route" "get_fmp_balance_sheet_statement_as_reported" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/balance-sheet-statement-as-reported/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# As Reported Cashflow Statements
#resource "aws_apigatewayv2_route" "get_fmp_cash_flow_statement_as_reported" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/cash-flow-statement-as-reported/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# As Reported Financial Statements
#resource "aws_apigatewayv2_route" "get_fmp_financial_statement_full_as_reported" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-statement-full-as-reported/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== SEC Filings Routes ==========

# Latest 8-K SEC Filings
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_8k" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/8k"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Latest SEC Filings (Financials)
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_latest" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/latest"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings By Form Type
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_form_type" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/form-type"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings By Symbol
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_symbol" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/symbol/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings By CIK
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_cik" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/cik/{cik}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings Company Search By Name
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_company_search_name" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/company-search/name"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings Company Search By Symbol
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_company_search_symbol" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/company-search/symbol/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Filings Company Search By CIK
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_company_search_cik" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/company-search/cik/{cik}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# SEC Company Full Profile
#resource "aws_apigatewayv2_route" "get_fmp_sec_filings_profile" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/sec-filings/profile/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Industry Classification List
#resource "aws_apigatewayv2_route" "get_fmp_industry_classification_list" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/industry-classification/list"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Industry Classification Search
#resource "aws_apigatewayv2_route" "get_fmp_industry_classification_search" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/industry-classification/search"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# All Industry Classification
#resource "aws_apigatewayv2_route" "get_fmp_industry_classification_all" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/industry-classification/all"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Company Search Routes ==========

# Search Symbol
#resource "aws_apigatewayv2_route" "get_fmp_search_symbol" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-symbol"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search Name
#resource "aws_apigatewayv2_route" "get_fmp_search_name" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-name"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search CIK
#resource "aws_apigatewayv2_route" "get_fmp_search_cik" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-cik"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search CUSIP
#resource "aws_apigatewayv2_route" "get_fmp_search_cusip" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-cusip"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search ISIN
#resource "aws_apigatewayv2_route" "get_fmp_search_isin" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-isin"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Company Screener
#resource "aws_apigatewayv2_route" "get_fmp_company_screener" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/company-screener"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search Exchange Variants
#resource "aws_apigatewayv2_route" "get_fmp_search_exchange_variants" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/search-exchange-variants"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Market Hours Routes ==========

# Exchange Market Hours
#resource "aws_apigatewayv2_route" "get_fmp_exchange_market_hours" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/exchange-market-hours"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Holidays By Exchange
#resource "aws_apigatewayv2_route" "get_fmp_holidays_by_exchange" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/holidays-by-exchange"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# All Exchange Market Hours
#resource "aws_apigatewayv2_route" "get_fmp_all_exchange_market_hours" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/all-exchange-market-hours"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Commodity ==========

# Commodities List
#resource "aws_apigatewayv2_route" "get_fmp_commodities_list" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities-list"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Commodities Quote
#resource "aws_apigatewayv2_route" "get_fmp_commodities_quote" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities-quote"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Commodities Quote Short
#resource "aws_apigatewayv2_route" "get_fmp_commodities_quote_short" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities-quote-short"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# All Commodities Quotes
#resource "aws_apigatewayv2_route" "get_fmp_batch_commodity_quotes" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/batch-commodity-quotes"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Light Chart (Historical Price EOD Light)
#resource "aws_apigatewayv2_route" "get_fmp_commodities_light_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities/light-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Full Chart (Historical Price EOD Full)
#resource "aws_apigatewayv2_route" "get_fmp_commodities_full_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities/full-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 1-Minute Interval Chart
# need subscription
# resource "aws_apigatewayv2_route" "get_fmp_commodities_chart_1min" {
#   api_id             = aws_apigatewayv2_api.http_data.id
#   route_key          = "GET /fmp/commodities/chart/1min/{symbol}"
#   target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
# }

# 5-Minute Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_commodities_chart_5min" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities/chart/5min/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 1-Hour Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_commodities_chart_1hour" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/commodities/chart/1hour/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== DCF (Discounted Cash Flow) ==========

# DCF Valuation
#resource "aws_apigatewayv2_route" "get_fmp_dcf" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dcf/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Levered DCF
#resource "aws_apigatewayv2_route" "get_fmp_dcf_levered" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dcf/levered/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Custom DCF Advanced
#resource "aws_apigatewayv2_route" "get_fmp_dcf_custom" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dcf/custom/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Custom DCF Levered
#resource "aws_apigatewayv2_route" "get_fmp_dcf_custom_levered" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dcf/custom-levered/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Crypto ==========

# Cryptocurrency List
#resource "aws_apigatewayv2_route" "get_fmp_crypto_list" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/list"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Cryptocurrency Quote
#resource "aws_apigatewayv2_route" "get_fmp_crypto_quote" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/quote"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Cryptocurrency Quote Short
#resource "aws_apigatewayv2_route" "get_fmp_crypto_quote_short" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/quote-short"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Batch Cryptocurrency Quotes
# need subscription
# resource "aws_apigatewayv2_route" "get_fmp_crypto_batch_quotes" {
#   api_id             = aws_apigatewayv2_api.http_data.id
#   route_key          = "GET /fmp/crypto/batch-quotes"
#   target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
# }

# Light Chart
#resource "aws_apigatewayv2_route" "get_fmp_crypto_light_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/light-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Full Chart
#resource "aws_apigatewayv2_route" "get_fmp_crypto_full_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/full-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 5-Minute Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_crypto_chart_5min" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/chart/5min/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 1-Hour Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_crypto_chart_1hour" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/crypto/chart/1hour/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Technical Indicators ==========

# Simple Moving Average (SMA)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_sma" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/sma/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Exponential Moving Average (EMA)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_ema" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/ema/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Weighted Moving Average (WMA)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_wma" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/wma/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Double Exponential Moving Average (DEMA)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_dema" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/dema/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Triple Exponential Moving Average (TEMA)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_tema" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/tema/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Relative Strength Index (RSI)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_rsi" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/rsi/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Standard Deviation
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_standard_deviation" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/standard-deviation/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Williams
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_williams" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/williams/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Average Directional Index (ADX)
#resource "aws_apigatewayv2_route" "get_fmp_technical_indicators_adx" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/technical-indicators/adx/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== ETF & Mutual Funds ==========

# ETF & Fund Holdings
#resource "aws_apigatewayv2_route" "get_fmp_etf_holdings" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/etf/holdings/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ETF & Mutual Fund Information
#resource "aws_apigatewayv2_route" "get_fmp_etf_info" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/etf/info/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ETF & Fund Country Allocation
#resource "aws_apigatewayv2_route" "get_fmp_etf_country_allocation" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/etf/country-allocation/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ETF Asset Exposure
#resource "aws_apigatewayv2_route" "get_fmp_etf_asset_exposure" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/etf/asset-exposure/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ETF Sector Weighting
#resource "aws_apigatewayv2_route" "get_fmp_etf_sector_weighting" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/etf/sector-weighting/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Economics ==========

# Treasury Rates
#resource "aws_apigatewayv2_route" "get_fmp_economics_treasury_rates" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/economics/treasury-rates"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Economic Indicators
#resource "aws_apigatewayv2_route" "get_fmp_economics_indicators" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/economics/indicators"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Economic Calendar
#resource "aws_apigatewayv2_route" "get_fmp_economics_calendar" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/economics/calendar"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Market Risk Premium
#resource "aws_apigatewayv2_route" "get_fmp_economics_market_risk_premium" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/economics/market-risk-premium"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Earnings, Dividends, Splits ==========

# Dividends Company
#resource "aws_apigatewayv2_route" "get_fmp_dividends" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dividends/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Dividends Calendar
#resource "aws_apigatewayv2_route" "get_fmp_dividends_calendar" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/dividends-calendar"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Earnings Report
#resource "aws_apigatewayv2_route" "get_fmp_earnings" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Earnings Calendar
#resource "aws_apigatewayv2_route" "get_fmp_earnings_calendar" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings-calendar"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# IPOs Calendar
#resource "aws_apigatewayv2_route" "get_fmp_ipos_calendar" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/ipos-calendar"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# IPOs Disclosure
#resource "aws_apigatewayv2_route" "get_fmp_ipos_disclosure" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/ipos-disclosure"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# IPOs Prospectus
#resource "aws_apigatewayv2_route" "get_fmp_ipos_prospectus" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/ipos-prospectus"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Stock Split Details
#resource "aws_apigatewayv2_route" "get_fmp_splits" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/splits/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Stock Splits Calendar
#resource "aws_apigatewayv2_route" "get_fmp_splits_calendar" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/splits-calendar"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Earnings Transcript ==========

# Latest Earning Transcripts
#resource "aws_apigatewayv2_route" "get_fmp_earnings_transcript_latest" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings-transcript/latest"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Earnings Transcript
#resource "aws_apigatewayv2_route" "get_fmp_earnings_transcript" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings-transcript/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Transcripts Dates By Symbol
#resource "aws_apigatewayv2_route" "get_fmp_earnings_transcript_dates" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings-transcript/dates/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Available Transcript Symbols
#resource "aws_apigatewayv2_route" "get_fmp_earnings_transcript_list" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/earnings-transcript/list"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== News ==========

# FMP Articles
#resource "aws_apigatewayv2_route" "get_fmp_news_fmp_articles" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/news/fmp-articles"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# General News
#resource "aws_apigatewayv2_route" "get_fmp_news_general" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/news/general"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Press Releases
# need subscription
# resource "aws_apigatewayv2_route" "get_fmp_news_press_releases" {
#   api_id             = aws_apigatewayv2_api.http_data.id
#   route_key          = "GET /fmp/news/press-releases"
#   target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
# }

# Stock News
#resource "aws_apigatewayv2_route" "get_fmp_news_stock" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/news/stock"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Crypto News
#resource "aws_apigatewayv2_route" "get_fmp_news_crypto" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/news/crypto"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Financial Estimates ==========

# Financial Estimates
#resource "aws_apigatewayv2_route" "get_fmp_financial_estimates" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/financial-estimates/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Ratings Snapshot
#resource "aws_apigatewayv2_route" "get_fmp_ratings_snapshot" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/ratings-snapshot/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Ratings
#resource "aws_apigatewayv2_route" "get_fmp_ratings_historical" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/ratings-historical/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Price Target Summary
#resource "aws_apigatewayv2_route" "get_fmp_price_target_summary" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/price-target-summary/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Price Target Consensus
#resource "aws_apigatewayv2_route" "get_fmp_price_target_consensus" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/price-target-consensus/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Stock Grades
#resource "aws_apigatewayv2_route" "get_fmp_grades" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/grades/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Stock Grades
#resource "aws_apigatewayv2_route" "get_fmp_grades_historical" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/grades-historical/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Stock Grades Summary
#resource "aws_apigatewayv2_route" "get_fmp_grades_consensus" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/grades-consensus/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Market Performance ==========

# Market Sector Performance Snapshot
#resource "aws_apigatewayv2_route" "get_fmp_market_sector_performance_snapshot" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/sector-performance-snapshot"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Industry Performance Snapshot
#resource "aws_apigatewayv2_route" "get_fmp_market_industry_performance_snapshot" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/industry-performance-snapshot"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Market Sector Performance
#resource "aws_apigatewayv2_route" "get_fmp_market_historical_sector_performance" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/historical-sector-performance"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Industry Performance
#resource "aws_apigatewayv2_route" "get_fmp_market_historical_industry_performance" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/historical-industry-performance"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Sector PE Snapshot
#resource "aws_apigatewayv2_route" "get_fmp_market_sector_pe_snapshot" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/sector-pe-snapshot"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Industry PE Snapshot
#resource "aws_apigatewayv2_route" "get_fmp_market_industry_pe_snapshot" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/industry-pe-snapshot"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Sector PE
#resource "aws_apigatewayv2_route" "get_fmp_market_historical_sector_pe" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/historical-sector-pe"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Industry PE
#resource "aws_apigatewayv2_route" "get_fmp_market_historical_industry_pe" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/historical-industry-pe"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Biggest Stock Gainers
#resource "aws_apigatewayv2_route" "get_fmp_market_biggest_gainers" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/biggest-gainers"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Biggest Stock Losers
#resource "aws_apigatewayv2_route" "get_fmp_market_biggest_losers" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/biggest-losers"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Top Traded Stocks
#resource "aws_apigatewayv2_route" "get_fmp_market_most_actives" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/market/most-actives"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Insider Trades ==========

# Latest Insider Trading
#resource "aws_apigatewayv2_route" "get_fmp_insider_trading_latest" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/insider-trading/latest"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search Insider Trades
#resource "aws_apigatewayv2_route" "get_fmp_insider_trading_search" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/insider-trading/search"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Search Insider Trades by Reporting Name
#resource "aws_apigatewayv2_route" "get_fmp_insider_trading_reporting_name" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/insider-trading/reporting-name"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# All Insider Transaction Types
#resource "aws_apigatewayv2_route" "get_fmp_insider_trading_transaction_types" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/insider-trading/transaction-types"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Insider Trade Statistics
#resource "aws_apigatewayv2_route" "get_fmp_insider_trading_statistics" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/insider-trading/statistics/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Acquisition Ownership
#resource "aws_apigatewayv2_route" "get_fmp_acquisition_ownership" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/acquisition-ownership/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Indexes ==========

# Stock Market Indexes List
#resource "aws_apigatewayv2_route" "get_fmp_indexes_list" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/list"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Index Quote
#resource "aws_apigatewayv2_route" "get_fmp_indexes_quote" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/quote"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Index Short Quote
#resource "aws_apigatewayv2_route" "get_fmp_indexes_quote_short" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/quote-short"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# All Index Quotes
#resource "aws_apigatewayv2_route" "get_fmp_indexes_batch_quotes" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/batch-quotes"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Light Chart
#resource "aws_apigatewayv2_route" "get_fmp_indexes_light_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/light-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Full Chart
#resource "aws_apigatewayv2_route" "get_fmp_indexes_full_chart" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/full-chart/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 5-Minute Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_indexes_chart_5min" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/chart/5min/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# 1-Hour Interval Chart
#resource "aws_apigatewayv2_route" "get_fmp_indexes_chart_1hour" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/chart/1hour/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# S&P 500 Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_sp500_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/sp500-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Nasdaq Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_nasdaq_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/nasdaq-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Dow Jones Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_dowjones_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/dowjones-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical S&P 500 Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_historical_sp500_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/historical-sp500-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Nasdaq Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_historical_nasdaq_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/historical-nasdaq-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Historical Dow Jones Constituent
#resource "aws_apigatewayv2_route" "get_fmp_indexes_historical_dowjones_constituent" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/indexes/historical-dowjones-constituent"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Senate ==========

# Latest Senate Financial Disclosures
#resource "aws_apigatewayv2_route" "get_fmp_senate_latest" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/senate/latest"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Latest House Financial Disclosures
#resource "aws_apigatewayv2_route" "get_fmp_house_latest" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/house/latest"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Senate Trading Activity
#resource "aws_apigatewayv2_route" "get_fmp_senate_trades" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/senate/trades/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Senate Trades By Name
#resource "aws_apigatewayv2_route" "get_fmp_senate_trades_by_name" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/senate/trades-by-name"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# U.S. House Trades
#resource "aws_apigatewayv2_route" "get_fmp_house_trades" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/house/trades/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# House Trades By Name
#resource "aws_apigatewayv2_route" "get_fmp_house_trades_by_name" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/house/trades-by-name"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# ========== Quote ==========

# Stock Quote (already defined at line 4)
# resource "aws_apigatewayv2_route" "get_fmp_quote" {
#   api_id             = aws_apigatewayv2_api.http_data.id
#   route_key          = "GET /fmp/quote/{symbol}"
#   target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
# }

# Stock Quote Short
#resource "aws_apigatewayv2_route" "get_fmp_quote_short" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/quote-short/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Aftermarket Trade
#resource "aws_apigatewayv2_route" "get_fmp_aftermarket_trade" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/aftermarket-trade/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Aftermarket Quote
#resource "aws_apigatewayv2_route" "get_fmp_aftermarket_quote" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/aftermarket-quote/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

# Stock Price Change
#resource "aws_apigatewayv2_route" "get_fmp_stock_price_change" {
#  api_id             = aws_apigatewayv2_api.http_data.id
#  route_key          = "GET /fmp/stock-price-change/{symbol}"
#  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
#  authorization_type = "JWT"
#  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
#}

