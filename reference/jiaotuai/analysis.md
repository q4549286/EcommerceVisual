# jiaotuai.cn reference notes

## Captured files

- `home.html`: server-rendered source for `https://www.jiaotuai.cn`.
- `studio.html`: server-rendered source for `https://www.jiaotuai.cn/studio`.
- `assets/`: downloaded JS/CSS and visible image assets referenced by those pages.

## Old interaction model

The old site uses three chat modes in one shared input shell:

- `standard`: normal conversation image editing. It accepts images and a free prompt.
- `quick`: the same input shell, positioned as faster continuous generation.
- `taotu`: ecommerce suite mode. It swaps in product image controls, reference image controls, model/ratio/size controls, and a short product-info textarea.

The important code path is visible in `assets/home-CK2cNvc5.js`:

- `studioChatRequestMode` stores the current mode.
- `standard`, `quick`, and `taotu` are rendered as tabs.
- `taotu` turns on `ProductSetControls`.
- The submit guard checks product image count, prompt text, model id, aspect ratio, and image size.

The inspiration waterfall is not static content. The page requests:

- `/api/v1/keyword/page`
- `/api/v1/keyword/detail/:id`

Those endpoints are not directly reachable from the static domain in this capture, but the source shows that clicking an inspiration card fetches detail data and injects it back into the chat input.

## Product conclusion

For this new project, ecommerce suite generation should be the primary workflow, not a sub-mode hidden under chat.

Recommended top-level model:

1. `电商套图` as the default first tab. This contains product image, reference image, auto-fill, product fields, output type selection, and usage-sorted capability capsules.
2. `对话修图` as a separate lightweight editor later. It should have its own chat box, uploaded images, and a custom prompt endpoint. It should not reuse ecommerce-suite prompts.
3. `文生图` as a clean text-only creator. It should avoid product-upload UI and should use text-to-image prompts.

The old `快速` mode should not come back as a top-level product concept. Speed belongs to execution behavior such as queueing, batch generation, and background tasks, not a separate user-facing mode.

## Current implementation direction

- Rename the current image-to-image tab to `电商套图`.
- Keep it first and default.
- Move quick capability capsules into `电商套图` only.
- Sort capsules by local use count so common actions move forward over time.
- Do not add `对话修图` until it has a separate generation path. Otherwise it will create confusing results because the current backend is tuned for ecommerce structured outputs.
