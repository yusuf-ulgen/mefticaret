import type { SectionField } from "@/lib/theme-sections";

import {
  MultiSelectField,
  NumberField,
  RadioField,
  RangeField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
  UrlField,
} from "./fields/studio-basic-fields";
import { ColorField } from "./fields/studio-color-field";
import { FontPickerField } from "./fields/studio-font-field";
import { ImagePickerField } from "./fields/studio-image-field";
import { CollectionPickerField, ProductPickerField } from "./fields/studio-picker-field";
import { RepeaterField } from "./fields/studio-repeater-field";
import { RichtextField } from "./fields/studio-richtext-field";

export type FieldValue = string | number | boolean;

const has = (key: string, ...needles: string[]) => needles.some((needle) => key.includes(needle));

/**
 * Bölüm ayarının kontrolünü şema + anahtar adına göre seçer.
 * Depolanan değer biçimi değişmez (metin / sayı / doğru-yanlış), böylece
 * mevcut tema verileri korunur.
 */
export function StudioField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: SectionField;
  value: FieldValue;
  onChange: (next: FieldValue) => void;
}) {
  const key = field.key.toLowerCase();
  const text = String(value ?? "");
  const common = { id, label: field.label, help: field.help };

  if (field.kind === "boolean") {
    return <SwitchField {...common} value={Boolean(value)} onChange={onChange} />;
  }

  if (field.kind === "select") {
    const options = field.options ?? [];
    if (has(key, "multi") || key.endsWith("_list")) {
      return <MultiSelectField {...common} value={text} options={options} onChange={onChange} />;
    }
    if (options.length > 0 && options.length <= 3) {
      return <RadioField {...common} value={text} options={options} onChange={onChange} />;
    }
    return <SelectField {...common} value={text} options={options} onChange={onChange} />;
  }

  if (field.kind === "number") {
    const current = Number(value) || 0;
    if (field.min !== undefined && field.max !== undefined) {
      return (
        <RangeField
          {...common}
          value={current}
          min={field.min}
          max={field.max}
          onChange={onChange}
        />
      );
    }
    return (
      <NumberField
        {...common}
        value={current}
        {...(field.min === undefined ? {} : { min: field.min })}
        {...(field.max === undefined ? {} : { max: field.max })}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "lines") {
    return <RepeaterField {...common} value={text} onChange={onChange} />;
  }

  if (field.kind === "code") {
    return <TextareaField {...common} value={text} rows={8} mono onChange={onChange} />;
  }

  if (field.kind === "textarea") {
    if (has(key, "richtext", "rich_text", "html", "body")) {
      return <RichtextField {...common} value={text} onChange={onChange} />;
    }
    return <TextareaField {...common} value={text} rows={3} onChange={onChange} />;
  }

  if (has(key, "color", "renk")) {
    return <ColorField {...common} value={text} onChange={onChange} />;
  }

  if (has(key, "image", "logo", "photo", "cover", "gorsel")) {
    return <ImagePickerField {...common} value={text} onChange={onChange} />;
  }

  if (has(key, "font")) {
    return <FontPickerField {...common} value={text} onChange={onChange} />;
  }

  if (has(key, "product_handle", "product_slug", "products")) {
    return <ProductPickerField {...common} value={text} multiple={key.endsWith("s")} onChange={onChange} />;
  }

  if (has(key, "collection", "category_handle", "category_slug")) {
    return (
      <CollectionPickerField {...common} value={text} multiple={key.endsWith("s")} onChange={onChange} />
    );
  }

  if (has(key, "url", "link", "href", "cta_target")) {
    return <UrlField {...common} value={text} onChange={onChange} />;
  }

  return (
    <TextField
      {...common}
      value={text}
      {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
      onChange={onChange}
    />
  );
}
