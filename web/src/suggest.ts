import { ApiError, type ApiClient } from "./api";
import type { Jar, SuggestionPayload } from "./types";

interface SuggestOptions {
  api: ApiClient;
  jars: readonly Jar[];
}

const fields = ["name", "url", "jarId", "description", "license", "repoUrl", "note"] as const;
type FieldName = typeof fields[number];

export function mountSuggest(container: HTMLElement, options: SuggestOptions): void {
  container.innerHTML = `
    <main class="wrap">
      <header class="top">
        <span class="brand">Open Source Spread</span>
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#">Home</a><a href="#pantry">Pantry</a><a href="#suggest" aria-current="page">Suggest</a>
        </nav>
        <button class="theme-toggle" type="button" aria-label="Toggle color theme">Theme</button>
      </header>
      <section class="suggest-layout" aria-labelledby="suggest-title">
        <div class="page-head">
          <p class="eyebrow">Add to the shelf</p>
          <h1 id="suggest-title">Suggest a tool.</h1>
          <p class="lede">Know a useful open source project? Send it over for a careful review.</p>
        </div>
        <form class="suggest-form" novalidate>
          <div class="form-status" role="status" aria-live="polite"></div>
          <label class="field">Tool name
            <input name="name" required maxlength="60" autocomplete="off">
            <span class="field-error" id="name-error"></span>
          </label>
          <label class="field">Project URL
            <input name="url" type="url" required placeholder="https://example.org">
            <span class="field-error" id="url-error"></span>
          </label>
          <label class="field">Jar
            <select name="jarId" required><option value="">Choose a jar</option></select>
            <span class="field-error" id="jarId-error"></span>
          </label>
          <label class="field">Description
            <textarea name="description" required minlength="10" maxlength="140" rows="4"></textarea>
            <span class="field-error" id="description-error"></span>
          </label>
          <label class="field">License <span class="optional">(optional)</span>
            <input name="license" autocomplete="off">
            <span class="field-error" id="license-error"></span>
          </label>
          <label class="field">Repository URL <span class="optional">(optional)</span>
            <input name="repoUrl" type="url" placeholder="https://github.com/example/project">
            <span class="field-error" id="repoUrl-error"></span>
          </label>
          <label class="field">Note <span class="optional">(optional)</span>
            <textarea name="note" rows="3"></textarea>
            <span class="field-error" id="note-error"></span>
          </label>
          <button class="btn" type="submit">Send suggestion</button>
        </form>
      </section>
    </main>`;

  const form = container.querySelector<HTMLFormElement>("form")!;
  const status = container.querySelector<HTMLElement>(".form-status")!;
  const submit = form.querySelector<HTMLButtonElement>("[type=submit]")!;
  const jarSelect = form.elements.namedItem("jarId") as HTMLSelectElement;
  for (const jar of options.jars) {
    const option = document.createElement("option");
    option.value = jar.id;
    option.textContent = jar.name;
    jarSelect.append(option);
  }

  const clearErrors = (): void => {
    for (const field of fields) {
      const input = form.elements.namedItem(field) as HTMLElement;
      input.removeAttribute("aria-describedby");
      input.removeAttribute("aria-invalid");
      form.querySelector<HTMLElement>(`#${field}-error`)!.textContent = "";
    }
  };
  const showErrors = (errors: Record<string, string>): void => {
    for (const [field, message] of Object.entries(errors)) {
      if (!fields.includes(field as FieldName)) continue;
      const input = form.elements.namedItem(field) as HTMLElement;
      const error = form.querySelector<HTMLElement>(`#${field}-error`)!;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", error.id);
      error.textContent = message;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    status.textContent = "";
    const values = new FormData(form);
    const value = (name: FieldName): string => String(values.get(name) ?? "").trim();
    const payload: SuggestionPayload = {
      name: value("name"),
      url: value("url"),
      jarId: value("jarId"),
      description: value("description"),
    };
    for (const name of ["license", "repoUrl", "note"] as const) {
      const optional = value(name);
      if (optional) payload[name] = optional;
    }
    submit.disabled = true;
    try {
      await options.api.submitSuggestion(payload);
      form.reset();
      status.textContent = "Thanks. Your suggestion is waiting for review.";
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        showErrors(error.fields);
        status.textContent = "Please correct the highlighted fields.";
      } else {
        status.textContent = "Your suggestion could not be sent. Please try again.";
      }
    } finally {
      submit.disabled = false;
    }
  });
  container.querySelector<HTMLButtonElement>(".theme-toggle")!.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });
}
