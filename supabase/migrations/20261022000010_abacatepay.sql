-- =====================================================================
-- Cotaí — AbacatePay como provedor de pagamento
-- Checkout hospedado (Pix, cartão e boleto). A escolha fica em settings
-- só para exibição; quem decide de fato é o secret PAYMENT_PROVIDER.
-- =====================================================================

alter table public.settings
  drop constraint settings_payment_provider_check,
  add constraint settings_payment_provider_check
    check (payment_provider in ('none', 'asaas', 'mercadopago', 'abacatepay'));
