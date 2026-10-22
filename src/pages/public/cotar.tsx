import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, ChipToggleGroup, Skeleton } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { DocumentInput, MoneyInput, PhoneInput } from "@/components/shared/inputs";
import { compressImage, uploadPhotos } from "@/features/quotes/upload";
import { usePublicSettings } from "@/features/settings/api";
import { previewFee } from "@/lib/fee";
import { money, toE164, waLink } from "@/lib/format";
import { isValidDocument } from "@/lib/masks";
import { invoke } from "@/lib/supabase";
import { cn, errorMessage } from "@/lib/utils";
import type { FeeResult, FieldMode, ProductCondition } from "@/types/domain";
import { PRODUCT_CONDITIONS } from "../../../supabase/functions/_shared/validation";
import { PixBox, type PixCharge, type PixManual } from "./pix-box";
import { PublicHeader, useDocumentTitle } from "./public-layout";

interface Photo {
  id: string;
  file: File;
  preview: string;
}

interface Product {
  key: string;
  name: string;
  description: string;
  reference_url: string;
  category_id: string;
  quantity: number;
  unit: string;
  target_price: number;
  notes: string;
  accepted_conditions: ProductCondition[];
  photos: Photo[];
}

const CONDITION_OPTIONS = Object.entries(PRODUCT_CONDITIONS).map(
  ([value, label]) => ({ value: value as ProductCondition, label }),
);

const newProduct = (): Product => ({
  key: crypto.randomUUID(),
  name: "",
  description: "",
  reference_url: "",
  category_id: "",
  quantity: 1,
  unit: "un",
  target_price: 0,
  notes: "",
  accepted_conditions: ["novo"],
  photos: [],
});

interface Created {
  code: string;
  token: string;
  status: string;
  fee: FeeResult;
  payment: PixCharge | null;
  pix_manual: PixManual | null;
  tracking_url: string;
}

type Errors = Record<string, string>;

const STEPS = ["Seus dados", "Produtos", "Resumo"];

function useFieldMode(fields: Record<string, FieldMode> | undefined) {
  return (name: string, fallback: FieldMode = "opcional"): FieldMode =>
    fields?.[name] ?? fallback;
}

export default function Cotar() {
  useDocumentTitle("Solicitar cotação");
  const { data: settings, isLoading } = usePublicSettings();
  const mode = useFieldMode(settings?.form.fields);

  const [step, setStep] = React.useState(0);
  const [customer, setCustomer] = React.useState({
    name: "",
    company: "",
    cnpj: "",
    whatsapp: "",
    email: "",
  });
  const [products, setProducts] = React.useState<Product[]>([newProduct()]);
  const [coupon, setCoupon] = React.useState("");
  const [showCoupon, setShowCoupon] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [website, setWebsite] = React.useState(""); // honeypot
  const [errors, setErrors] = React.useState<Errors>({});
  const [fee, setFee] = React.useState<FeeResult | null>(null);
  const [feeLoading, setFeeLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<Created | null>(null);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState(0); // fotos sendo comprimidas

  const maxItems = settings?.form.max_items ?? 10;
  const maxPhotos = settings?.form.max_photos ?? 5;
  const maxMb = settings?.form.max_photo_mb ?? 10;

  React.useEffect(
    () => () =>
      products.forEach((p) =>
        p.photos.forEach((ph) => URL.revokeObjectURL(ph.preview)),
      ),
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // taxa calculada no servidor
  const refreshFee = React.useCallback(async () => {
    if (!settings?.charge.enabled) {
      setFee(null);
      return;
    }
    setFeeLoading(true);
    try {
      setFee(
        await invoke<FeeResult>("calculate-fee", {
          item_count: products.length,
          coupon: coupon.trim() || null,
        }),
      );
    } catch {
      setFee(null);
    } finally {
      setFeeLoading(false);
    }
  }, [settings?.charge.enabled, products.length, coupon]);

  // Calcula já ao abrir o formulário (e a cada produto a mais), não só no resumo:
  // a Edge Function demora na primeira chamada e o valor fica pronto antes de o cliente chegar lá
  React.useEffect(() => {
    void refreshFee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.charge.enabled, products.length]);

  // ----- validação por etapa
  function validateCustomer(): Errors {
    const e: Errors = {};
    const r = z
      .object({
        name: z.string().trim().min(2, "Informe seu nome"),
        company: z.string().trim().min(1, "Informe a empresa"),
        email: z.email("E-mail inválido"),
      })
      .safeParse(customer);
    if (!r.success)
      for (const i of r.error.issues) e[String(i.path[0])] = i.message;
    if (!toE164(customer.whatsapp)) e.whatsapp = "WhatsApp inválido";
    if (!customer.cnpj) e.cnpj = "Informe o CPF ou CNPJ";
    else if (!isValidDocument(customer.cnpj)) e.cnpj = "CPF ou CNPJ inválido";
    return e;
  }

  function validateProducts(): Errors {
    const e: Errors = {};
    products.forEach((p, i) => {
      if (!p.name.trim()) e[`${i}.name`] = "Diga qual é o produto";
      if (!p.quantity || p.quantity < 1)
        e[`${i}.quantity`] = "Quantidade mínima: 1";
      if (!p.target_price || p.target_price <= 0)
        e[`${i}.target_price`] = "Informe quanto quer pagar";
      if (p.accepted_conditions.length === 0)
        e[`${i}.accepted_conditions`] = "Escolha pelo menos um estado";
      if (p.photos.length === 0)
        e[`${i}.photos`] = "Adicione pelo menos uma foto";
      if (mode("reference_url") === "obrigatorio" && !p.reference_url)
        e[`${i}.reference_url`] = "Campo obrigatório";
      if (p.reference_url && !/^https?:\/\//i.test(p.reference_url))
        e[`${i}.reference_url`] = "O link deve começar com http";
      if (mode("notes") === "obrigatorio" && !p.notes.trim())
        e[`${i}.notes`] = "Campo obrigatório";
      if (mode("category", "oculto") === "obrigatorio" && !p.category_id)
        e[`${i}.category_id`] = "Escolha uma categoria";
    });
    return e;
  }

  function next() {
    const e =
      step === 0 ? validateCustomer() : step === 1 ? validateProducts() : {};
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Confira os campos destacados");
      requestAnimationFrame(() =>
        document
          .querySelector('[aria-invalid="true"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateProduct(key: string, patch: Partial<Product>) {
    setProducts((ps) =>
      ps.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  }

  async function addPhotos(key: string, list: FileList | null) {
    if (!list) return;
    const product = products.find((p) => p.key === key)!;
    const room = maxPhotos - product.photos.length;
    const files = Array.from(list).slice(0, room);
    if (list.length > room)
      toast.info(`Máximo de ${maxPhotos} fotos por produto`);
    const added: Photo[] = [];
    setProcessing((n) => n + 1);
    try {
      for (const f of files) {
        if (!f.type.startsWith("image/")) {
          toast.error(`"${f.name}" não é uma imagem`);
          continue;
        }
        if (f.size > maxMb * 1024 * 1024 * 3) {
          toast.error(`"${f.name}" é grande demais`);
          continue;
        }
        const compressed = await compressImage(f);
        if (compressed.size > maxMb * 1024 * 1024) {
          toast.error(`"${f.name}" passa de ${maxMb} MB mesmo comprimida`);
          continue;
        }
        added.push({
          id: crypto.randomUUID(),
          file: compressed,
          preview: URL.createObjectURL(compressed),
        });
      }
    } finally {
      setProcessing((n) => n - 1);
    }
    setProducts((ps) =>
      ps.map((p) =>
        p.key === key ? { ...p, photos: [...p.photos, ...added] } : p,
      ),
    );
    if (added.length) {
      const idx = products.findIndex((p) => p.key === key);
      setErrors((e) => {
        const { [`${idx}.photos`]: _drop, ...rest } = e;
        return rest;
      });
    }
  }

  async function submit() {
    if (!accepted) {
      setErrors({ terms: "É preciso aceitar os termos" });
      return;
    }
    if (fee?.coupon_error) {
      toast.error(fee.coupon_error);
      return;
    }
    try {
      setSubmitting("Enviando fotos…");
      const allFiles = products.flatMap((p) => p.photos.map((ph) => ph.file));
      const paths = await uploadPhotos(allFiles, (d, t) =>
        setSubmitting(`Enviando fotos (${d}/${t})…`),
      );
      let cursor = 0;
      const items = products.map((p) => {
        const photos = paths.slice(cursor, cursor + p.photos.length);
        cursor += p.photos.length;
        return {
          name: p.name,
          description: p.description || null,
          reference_url: p.reference_url || null,
          category_id: p.category_id || null,
          quantity: p.quantity,
          unit: p.unit,
          target_price: p.target_price,
          notes: p.notes || null,
          accepted_conditions: p.accepted_conditions,
          photos,
        };
      });
      setSubmitting("Registrando pedido…");
      const res = await invoke<Created>("create-quote-request", {
        customer: { ...customer, whatsapp: toE164(customer.whatsapp) },
        items,
        coupon: coupon.trim() || null,
        accepted_terms: true,
        website,
      });
      setCreated(res);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(null);
    }
  }

  if (created)
    return (
      <Success
        created={created}
        contact={settings?.contact_whatsapp}
        eta={settings?.eta_text}
      />
    );

  const totalTarget = products.reduce(
    (acc, p) => acc + p.quantity * p.target_price,
    0,
  );
  const charge = settings?.charge;
  const units = settings?.units?.length
    ? settings.units
    : [{ code: "un", label: "Unidade" }];

  return (
    <div className="min-h-dvh bg-bg-alt">
      <PublicHeader links={false} cta={false} />
      <main className="mx-auto max-w-[640px] px-4 pb-32 pt-8 sm:px-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-[15px] text-accent-text"
        >
          <ArrowLeft className="size-4" /> Início
        </Link>
        <h1 className="text-[34px] font-semibold leading-tight">
          Solicitar cotação
        </h1>

        {/* stepper */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-2">
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  i <= step
                    ? "bg-accent"
                    : "bg-[color-mix(in_srgb,var(--fg)_12%,transparent)]",
                )}
              />
              <span
                className={cn(
                  "text-[13px]",
                  i === step ? "font-semibold text-fg" : "text-fg-3",
                )}
              >
                {i + 1}. {s}
              </span>
            </li>
          ))}
        </ol>

        {isLoading ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <div
            className="mt-8"
            key={step}
            style={{
              animation: "rise 400ms cubic-bezier(0.25,0.1,0.25,1) both",
            }}
          >
            {/* honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              aria-hidden
            />

            {step === 0 && (
              <div className="space-y-5 rounded-[22px] bg-surface p-5 sm:p-6">
                <Field
                  label="Nome completo"
                  required
                  error={errors.name}
                  htmlFor="name"
                >
                  <Input
                    id="name"
                    autoComplete="name"
                    value={customer.name}
                    aria-invalid={!!errors.name}
                    onChange={(e) =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Empresa"
                  required
                  error={errors.company}
                  htmlFor="company"
                >
                  <Input
                    id="company"
                    autoComplete="organization"
                    value={customer.company}
                    aria-invalid={!!errors.company}
                    onChange={(e) =>
                      setCustomer({ ...customer, company: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="CPF ou CNPJ"
                  required
                  error={errors.cnpj}
                  htmlFor="cnpj"
                >
                  <DocumentInput
                    id="cnpj"
                    value={customer.cnpj}
                    aria-invalid={!!errors.cnpj}
                    onValueChange={(v) => setCustomer({ ...customer, cnpj: v })}
                  />
                </Field>
                <Field
                  label="WhatsApp"
                  required
                  error={errors.whatsapp}
                  hint="Enviaremos a cotação por aqui"
                  htmlFor="whatsapp"
                >
                  <PhoneInput
                    id="whatsapp"
                    value={customer.whatsapp}
                    aria-invalid={!!errors.whatsapp}
                    onValueChange={(v) =>
                      setCustomer({ ...customer, whatsapp: v })
                    }
                  />
                </Field>
                <Field
                  label="E-mail"
                  required
                  error={errors.email}
                  htmlFor="email"
                >
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={customer.email}
                    aria-invalid={!!errors.email}
                    onChange={(e) =>
                      setCustomer({ ...customer, email: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {products.map((p, i) => (
                  <div
                    key={p.key}
                    className="rounded-[22px] bg-surface p-5 sm:p-6"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[19px] font-semibold">
                        Produto {i + 1}
                      </h2>
                      {products.length > 1 && (
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() =>
                            setProducts((ps) =>
                              ps.filter((x) => x.key !== p.key),
                            )
                          }
                        >
                          <Trash2 className="size-4" /> Remover
                        </Button>
                      )}
                    </div>

                    <div className="space-y-5">
                      <Field
                        label={`Fotos (até ${maxPhotos})`}
                        required
                        error={errors[`${i}.photos`]}
                      >
                        <div
                          className="flex flex-wrap gap-2"
                          aria-invalid={!!errors[`${i}.photos`]}
                        >
                          {p.photos.map((ph) => (
                            <div key={ph.id} className="relative">
                              <img
                                src={ph.preview}
                                alt=""
                                className="size-20 rounded-xl object-cover"
                              />
                              <button
                                type="button"
                                aria-label="Remover foto"
                                onClick={() => {
                                  URL.revokeObjectURL(ph.preview);
                                  updateProduct(p.key, {
                                    photos: p.photos.filter(
                                      (x) => x.id !== ph.id,
                                    ),
                                  });
                                }}
                                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-fg text-bg"
                              >
                                <X className="size-3.5" strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                          {p.photos.length < maxPhotos && (
                            <>
                              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--fg)_25%,transparent)] text-fg-2 hover:border-accent hover:text-accent-text sm:hidden">
                                <Camera className="size-5" strokeWidth={1.75} />
                                <span className="text-[11px]">Câmera</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="sr-only"
                                  onChange={(e) => {
                                    void addPhotos(p.key, e.target.files);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <label
                                className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--fg)_25%,transparent)] text-fg-2 hover:border-accent hover:text-accent-text"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  void addPhotos(p.key, e.dataTransfer.files);
                                }}
                              >
                                <ImagePlus
                                  className="size-5"
                                  strokeWidth={1.75}
                                />
                                <span className="text-[11px]">Galeria</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="sr-only"
                                  onChange={(e) => {
                                    void addPhotos(p.key, e.target.files);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </Field>

                      <Field
                        label="Qual é o produto?"
                        required
                        error={errors[`${i}.name`]}
                        htmlFor={`name-${p.key}`}
                      >
                        <Input
                          id={`name-${p.key}`}
                          placeholder="Ex.: Cadeira de escritório giratória"
                          value={p.name}
                          aria-invalid={!!errors[`${i}.name`]}
                          onChange={(e) =>
                            updateProduct(p.key, { name: e.target.value })
                          }
                        />
                      </Field>

                      {mode("category", "oculto") !== "oculto" &&
                        (settings?.categories.length ?? 0) > 0 && (
                          <Field
                            label="Categoria"
                            required={
                              mode("category", "oculto") === "obrigatorio"
                            }
                            error={errors[`${i}.category_id`]}
                          >
                            <NativeSelect
                              value={p.category_id}
                              aria-invalid={!!errors[`${i}.category_id`]}
                              onChange={(e) =>
                                updateProduct(p.key, {
                                  category_id: e.target.value,
                                })
                              }
                            >
                              <option value="">Selecione</option>
                              {settings!.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </Field>
                        )}

                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Field
                          label="Quantidade"
                          required
                          error={errors[`${i}.quantity`]}
                        >
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            className="tabular"
                            value={p.quantity || ""}
                            aria-invalid={!!errors[`${i}.quantity`]}
                            onChange={(e) =>
                              updateProduct(p.key, {
                                quantity: Math.max(
                                  0,
                                  Math.floor(Number(e.target.value)),
                                ),
                              })
                            }
                          />
                        </Field>
                        {mode("unit") !== "oculto" && (
                          <Field label="Unidade">
                            <NativeSelect
                              value={p.unit}
                              onChange={(e) =>
                                updateProduct(p.key, { unit: e.target.value })
                              }
                              className="w-32"
                            >
                              {units.map((u) => (
                                <option key={u.code} value={u.code}>
                                  {u.label}
                                </option>
                              ))}
                            </NativeSelect>
                          </Field>
                        )}
                      </div>

                      <Field
                        label="Preço-alvo por unidade"
                        required
                        error={errors[`${i}.target_price`]}
                        hint="Quanto você quer pagar em cada unidade"
                      >
                        <MoneyInput
                          value={p.target_price}
                          aria-invalid={!!errors[`${i}.target_price`]}
                          onValueChange={(v) =>
                            updateProduct(p.key, { target_price: v })
                          }
                        />
                      </Field>

                      <Field
                        label="Estado do produto"
                        required
                        error={errors[`${i}.accepted_conditions`]}
                        hint="Marque todos que você aceita"
                      >
                        <ChipToggleGroup
                          aria-label={`Estado aceito do produto ${i + 1}`}
                          options={CONDITION_OPTIONS}
                          value={p.accepted_conditions}
                          invalid={!!errors[`${i}.accepted_conditions`]}
                          onChange={(v) => {
                            updateProduct(p.key, { accepted_conditions: v });
                            if (v.length)
                              setErrors((e) => {
                                const { [`${i}.accepted_conditions`]: _drop, ...rest } = e;
                                return rest;
                              });
                          }}
                        />
                      </Field>

                      {mode("reference_url") !== "oculto" && (
                        <Field
                          label="Link de referência"
                          required={mode("reference_url") === "obrigatorio"}
                          hint={
                            mode("reference_url") === "opcional"
                              ? "Opcional"
                              : undefined
                          }
                          error={errors[`${i}.reference_url`]}
                        >
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder="https://"
                            value={p.reference_url}
                            aria-invalid={!!errors[`${i}.reference_url`]}
                            onChange={(e) =>
                              updateProduct(p.key, {
                                reference_url: e.target.value,
                              })
                            }
                          />
                        </Field>
                      )}

                      {mode("notes") !== "oculto" && (
                        <Field
                          label="Observações"
                          required={mode("notes") === "obrigatorio"}
                          hint="Cor, tamanho, marca, especificações"
                          error={errors[`${i}.notes`]}
                        >
                          <Textarea
                            value={p.notes}
                            aria-invalid={!!errors[`${i}.notes`]}
                            onChange={(e) =>
                              updateProduct(p.key, { notes: e.target.value })
                            }
                          />
                        </Field>
                      )}

                      {p.quantity > 0 && p.target_price > 0 && (
                        <p className="text-right text-[15px] text-fg-2">
                          Total-alvo:{" "}
                          <span className="font-semibold text-fg tabular">
                            {money(p.quantity * p.target_price)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {products.length < maxItems && (
                  <button
                    type="button"
                    onClick={() => setProducts((ps) => [...ps, newProduct()])}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-[color-mix(in_srgb,var(--fg)_20%,transparent)] text-[17px] font-medium text-accent-text hover:bg-surface"
                  >
                    <Plus className="size-5" /> Adicionar outro produto
                  </button>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-[22px] bg-surface p-5 sm:p-6">
                  <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">
                    Seus dados
                  </h2>
                  <p className="mt-2 font-semibold">{customer.name}</p>
                  <p className="text-[15px] text-fg-2">
                    {customer.company} · {customer.cnpj} · {customer.whatsapp} ·{" "}
                    {customer.email}
                  </p>
                  <button
                    className="mt-2 text-[15px] text-accent-text"
                    onClick={() => setStep(0)}
                  >
                    Alterar
                  </button>
                </div>

                <div className="rounded-[22px] bg-surface p-5 sm:p-6">
                  <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">
                    Produtos
                  </h2>
                  <ul className="mt-3 divide-y divide-line">
                    {products.map((p) => (
                      <li key={p.key} className="flex items-center gap-3 py-3">
                        <img
                          src={p.photos[0]?.preview}
                          alt=""
                          className="size-12 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-[13px] text-fg-2 tabular">
                            {p.quantity} {p.unit} × {money(p.target_price)} ·{" "}
                            {p.accepted_conditions
                              .map((c) => PRODUCT_CONDITIONS[c])
                              .join(", ")}
                          </p>
                        </div>
                        <span className="font-semibold tabular">
                          {money(p.quantity * p.target_price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between border-t border-line pt-3">
                    <span className="text-fg-2">Total-alvo</span>
                    <span className="font-semibold tabular">
                      {money(totalTarget)}
                    </span>
                  </div>
                  <button
                    className="mt-2 text-[15px] text-accent-text"
                    onClick={() => setStep(1)}
                  >
                    Alterar
                  </button>
                </div>

                {charge?.enabled && (
                  <div className="rounded-[22px] bg-surface p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[17px]">Taxa de cotação</span>
                      {feeLoading && !fee ? (
                        // Prévia local enquanto o valor oficial (calculate-fee) não chega
                        <span className="text-[21px] font-semibold tabular text-fg-3">
                          {money(previewFee(charge, products.length))}
                        </span>
                      ) : (
                        <span className="text-[21px] font-semibold tabular">
                          {money(fee?.total ?? 0)}
                        </span>
                      )}
                    </div>
                    {fee && fee.discount > 0 && (
                      <p className="mt-1 text-right text-[13px] text-accent-text tabular">
                        {money(fee.base)} − {money(fee.discount)} de desconto
                      </p>
                    )}
                    {charge.deduct_on_purchase && (fee?.total ?? 0) > 0 && (
                      <p className="mt-2 text-[13px] text-fg-2">
                        Se você aprovar a compra, a taxa é abatida do total.
                      </p>
                    )}
                    {charge.moment === "depois" && (fee?.total ?? 0) > 0 && (
                      <p className="mt-2 text-[13px] text-fg-2">
                        Você paga a taxa para liberar a cotação quando ela
                        estiver pronta.
                      </p>
                    )}
                    {charge.has_coupons && (
                      <div className="mt-4">
                        {showCoupon ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Código do cupom"
                              value={coupon}
                              onChange={(e) =>
                                setCoupon(e.target.value.toUpperCase())
                              }
                              className="uppercase"
                            />
                            <Button
                              variant="secondary"
                              onClick={() => void refreshFee()}
                              loading={feeLoading}
                            >
                              Aplicar
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-[15px] text-accent-text"
                            onClick={() => setShowCoupon(true)}
                          >
                            Tenho um cupom
                          </button>
                        )}
                        {fee?.coupon_error && (
                          <p className="mt-2 text-[13px] text-[var(--status-red)]">
                            {fee.coupon_error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-3 rounded-[22px] bg-surface p-5">
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={(v) => {
                      setAccepted(v === true);
                      setErrors({});
                    }}
                    className="mt-0.5"
                  />
                  <span className="text-[15px]">
                    Li e concordo com os{" "}
                    <button
                      type="button"
                      className="text-accent-text underline underline-offset-2"
                      onClick={() => setTermsOpen(true)}
                    >
                      termos
                    </button>
                    .
                    {errors.terms && (
                      <span className="block text-[13px] text-[var(--status-red)]">
                        {errors.terms}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
      </main>

      {/* barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-chrome backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 px-4 py-3 sm:px-6">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
              disabled={!!submitting}
            >
              Voltar
            </Button>
          )}
          {step < 2 ? (
            <Button className="flex-1" onClick={next} loading={processing > 0}>
              {processing > 0 ? "Processando fotos…" : "Continuar"}
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={submit}
              loading={!!submitting}
              disabled={feeLoading}
            >
              {submitting ??
                ((fee?.total ?? 0) > 0 && charge?.moment === "antes"
                  ? "Confirmar e pagar"
                  : "Enviar pedido")}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent title="Termos" size="md">
          <p className="whitespace-pre-line text-[15px] text-fg-2">
            {settings?.terms_text || "Sem termos cadastrados."}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Success({
  created,
  contact,
  eta,
}: {
  created: Created;
  contact?: string | null;
  eta?: string;
}) {
  const amount = Number(created.fee?.total ?? 0);
  const needsPayment = amount > 0 && created.status === "aguardando_pagamento";
  const trackingPath =
    new URL(created.tracking_url, window.location.origin).pathname +
    new URL(created.tracking_url, window.location.origin).search;
  const wa = waLink(
    contact,
    `Olá! Acabei de enviar o pedido de cotação ${created.code}.`,
  );
  return (
    <div className="min-h-dvh bg-bg-alt">
      <PublicHeader links={false} cta={false} />
      <main className="mx-auto max-w-[560px] px-4 py-14 text-center sm:px-6">
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-on-accent"
          style={{ animation: "rise 500ms both" }}
        >
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-[34px] font-semibold leading-tight">
          Pedido recebido
        </h1>
        <p className="mt-2 text-[19px] text-fg-2">
          Seu código é <b className="text-fg tabular">{created.code}</b>.
          {needsPayment
            ? " Falta só o pagamento da taxa para entrar na fila."
            : ` Vamos responder ${eta ?? "em breve"}.`}
        </p>

        {needsPayment && (
          <div className="mt-8 text-left">
            <PixBox
              amount={amount}
              charge={created.payment}
              manual={created.pix_manual}
            />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild>
            <Link to={trackingPath}>Acompanhar pedido</Link>
          </Button>
          {wa && (
            <Button asChild variant="secondary">
              <a href={wa} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </a>
            </Button>
          )}
        </div>
        <p className="mt-6 text-[13px] text-fg-3">
          Também enviamos o link de acompanhamento para o seu WhatsApp e e-mail.
        </p>
      </main>
    </div>
  );
}
