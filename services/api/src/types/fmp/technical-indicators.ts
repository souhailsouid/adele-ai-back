/**
 * Types pour les endpoints Technical Indicators de FMP
 */

// ========== Common Query Parameters ==========

export interface TechnicalIndicatorQueryParams {
  symbol: string; // Required
  periodLength: number; // e.g., 10
  timeframe: string; // e.g., "1day", "1hour", "5min", etc.
  from?: string; // e.g., "2025-09-09"
  to?: string; // e.g., "2025-12-09"
}

// ========== Common Response Fields ==========

export interface TechnicalIndicatorBasePoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

// ========== Simple Moving Average (SMA) ==========

export interface SMAResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  sma: number;
}

export type SMAResponseArray = SMAResponse[];

// ========== Exponential Moving Average (EMA) ==========

export interface EMAResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  ema: number;
}

export type EMAResponseArray = EMAResponse[];

// ========== Weighted Moving Average (WMA) ==========

export interface WMAResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  wma: number;
}

export type WMAResponseArray = WMAResponse[];

// ========== Double Exponential Moving Average (DEMA) ==========

export interface DEMAResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  dema: number;
}

export type DEMAResponseArray = DEMAResponse[];

// ========== Triple Exponential Moving Average (TEMA) ==========

export interface TEMAResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  tema: number;
}

export type TEMAResponseArray = TEMAResponse[];

// ========== Relative Strength Index (RSI) ==========

export interface RSIResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  rsi: number;
}

export type RSIResponseArray = RSIResponse[];

// ========== Standard Deviation ==========

export interface StandardDeviationResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  standardDeviation: number;
}

export type StandardDeviationResponseArray = StandardDeviationResponse[];

// ========== Williams ==========

export interface WilliamsResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  williams: number;
}

export type WilliamsResponseArray = WilliamsResponse[];

// ========== Average Directional Index (ADX) ==========

export interface ADXResponse {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  adx: number;
}

export type ADXResponseArray = ADXResponse[];

