/**
 * Currency utilities
 * Common ISO 4217 currency codes and names
 */

/**
 * Currency interface
 */
export interface Currency {
  code: string;
  name: string;
}

/**
 * List of common ISO 4217 currencies
 * VND and USD are prioritized at the top
 */
export const CURRENCIES: Currency[] = [
  // Priority currencies at the top
  {code: 'VND', name: 'Vietnamese Dong'},
  {code: 'USD', name: 'US Dollar'},
  // Other common currencies
  {code: 'EUR', name: 'Euro'},
  {code: 'GBP', name: 'British Pound'},
  {code: 'JPY', name: 'Japanese Yen'},
  {code: 'CNY', name: 'Chinese Yuan'},
  {code: 'AUD', name: 'Australian Dollar'},
  {code: 'CAD', name: 'Canadian Dollar'},
  {code: 'CHF', name: 'Swiss Franc'},
  {code: 'HKD', name: 'Hong Kong Dollar'},
  {code: 'SGD', name: 'Singapore Dollar'},
  {code: 'KRW', name: 'South Korean Won'},
  {code: 'INR', name: 'Indian Rupee'},
  {code: 'BRL', name: 'Brazilian Real'},
  {code: 'MXN', name: 'Mexican Peso'},
  {code: 'RUB', name: 'Russian Ruble'},
  {code: 'ZAR', name: 'South African Rand'},
  {code: 'TRY', name: 'Turkish Lira'},
  {code: 'SEK', name: 'Swedish Krona'},
  {code: 'NOK', name: 'Norwegian Krone'},
  {code: 'DKK', name: 'Danish Krone'},
  {code: 'PLN', name: 'Polish Zloty'},
  {code: 'THB', name: 'Thai Baht'},
  {code: 'MYR', name: 'Malaysian Ringgit'},
  {code: 'IDR', name: 'Indonesian Rupiah'},
  {code: 'PHP', name: 'Philippine Peso'},
  {code: 'NZD', name: 'New Zealand Dollar'},
  {code: 'ILS', name: 'Israeli Shekel'},
  {code: 'AED', name: 'UAE Dirham'},
  {code: 'SAR', name: 'Saudi Riyal'},
  {code: 'ARS', name: 'Argentine Peso'},
  {code: 'CLP', name: 'Chilean Peso'},
  {code: 'COP', name: 'Colombian Peso'},
  {code: 'PEN', name: 'Peruvian Sol'},
  {code: 'EGP', name: 'Egyptian Pound'},
  {code: 'NGN', name: 'Nigerian Naira'},
  {code: 'PKR', name: 'Pakistani Rupee'},
  {code: 'BDT', name: 'Bangladeshi Taka'},
  {code: 'LKR', name: 'Sri Lankan Rupee'},
  {code: 'NPR', name: 'Nepalese Rupee'},
  {code: 'MMK', name: 'Myanmar Kyat'},
  {code: 'KHR', name: 'Cambodian Riel'},
  {code: 'LAK', name: 'Lao Kip'},
  {code: 'BND', name: 'Brunei Dollar'},
  {code: 'TWD', name: 'Taiwan Dollar'},
  {code: 'HUF', name: 'Hungarian Forint'},
  {code: 'CZK', name: 'Czech Koruna'},
  {code: 'RON', name: 'Romanian Leu'},
  {code: 'BGN', name: 'Bulgarian Lev'},
  {code: 'HRK', name: 'Croatian Kuna'},
  {code: 'RSD', name: 'Serbian Dinar'},
  {code: 'UAH', name: 'Ukrainian Hryvnia'},
  {code: 'KZT', name: 'Kazakhstani Tenge'},
  {code: 'QAR', name: 'Qatari Riyal'},
  {code: 'KWD', name: 'Kuwaiti Dinar'},
  {code: 'OMR', name: 'Omani Rial'},
  {code: 'BHD', name: 'Bahraini Dinar'},
  {code: 'JOD', name: 'Jordanian Dinar'},
  {code: 'LBP', name: 'Lebanese Pound'},
  {code: 'ISK', name: 'Icelandic Krona'},
  {code: 'FJD', name: 'Fijian Dollar'},
  {code: 'PGK', name: 'Papua New Guinean Kina'},
  {code: 'XPF', name: 'CFP Franc'},
  {code: 'NIO', name: 'Nicaraguan Cordoba'},
  {code: 'GTQ', name: 'Guatemalan Quetzal'},
  {code: 'CRC', name: 'Costa Rican Colon'},
  {code: 'PAB', name: 'Panamanian Balboa'},
  {code: 'BOB', name: 'Bolivian Boliviano'},
  {code: 'PYG', name: 'Paraguayan Guarani'},
  {code: 'UYU', name: 'Uruguayan Peso'},
  {code: 'DOP', name: 'Dominican Peso'},
  {code: 'JMD', name: 'Jamaican Dollar'},
  {code: 'BBD', name: 'Barbadian Dollar'},
  {code: 'BZD', name: 'Belize Dollar'},
  {code: 'XCD', name: 'East Caribbean Dollar'},
  {code: 'AWG', name: 'Aruban Florin'},
  {code: 'ANG', name: 'Netherlands Antillean Guilder'},
  {code: 'TTD', name: 'Trinidad and Tobago Dollar'},
  {code: 'GYD', name: 'Guyanese Dollar'},
  {code: 'SRD', name: 'Surinamese Dollar'},
  {code: 'BWP', name: 'Botswana Pula'},
  {code: 'ZMW', name: 'Zambian Kwacha'},
  {code: 'KES', name: 'Kenyan Shilling'},
  {code: 'UGX', name: 'Ugandan Shilling'},
  {code: 'TZS', name: 'Tanzanian Shilling'},
  {code: 'ETB', name: 'Ethiopian Birr'},
  {code: 'MAD', name: 'Moroccan Dirham'},
  {code: 'TND', name: 'Tunisian Dinar'},
  {code: 'DZD', name: 'Algerian Dinar'},
  {code: 'LYD', name: 'Libyan Dinar'},
  {code: 'GHS', name: 'Ghanaian Cedi'},
  {code: 'XOF', name: 'West African CFA Franc'},
  {code: 'XAF', name: 'Central African CFA Franc'},
];

/**
 * Get currency by code
 * @param code - Currency code (e.g., "USD")
 * @returns Currency object or undefined if not found
 */
export function getCurrencyByCode(code: string): Currency | undefined {
  return CURRENCIES.find((currency) => currency.code === code);
}

/**
 * Get currency name by code
 * @param code - Currency code (e.g., "USD")
 * @returns Currency name or code if not found
 */
export function getCurrencyName(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency?.name ?? code;
}

