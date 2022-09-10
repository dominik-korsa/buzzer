import jsyaml from 'js-yaml';
import { ConfigSchema, validateConfig } from "./config-schema.js";
import { run } from "./main.js";
import { Config, parseConfig } from "./config-parser.js";

const configDialog = document.getElementById('config-dialog') as HTMLDialogElement;
const configHistory = document.getElementById('config-dialog__history')!;
configDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
});

function showConfigWithError(message: unknown, details: unknown = '') {
  document.getElementById('config-dialog-error')!.classList.remove('hidden');
  document.getElementById('config-dialog-error__message')!.innerText = message instanceof Error ? message.message : `${message}`;
  document.getElementById('config-dialog-error__details')!.innerText = details instanceof Error ? details.message : `${details}`;
  configDialog.showModal();
}

async function loadConfig(): Promise<Config | null> {
  const params = new URLSearchParams(window.location.search);
  const configUrl = params.get('config');
  if (!configUrl) {
    configDialog.showModal();
    return null;
  }

  let inputConfig: ConfigSchema;
  try {
    const response = await fetch(configUrl);
    if (!response.ok) {
      showConfigWithError('Cannot load configuration', `Server responded with status code ${response.status} ${response.statusText}`);
      return null;
    }
    const data = jsyaml.load(await response.text());
    validateConfig(data);
    inputConfig = data;
  } catch (error) {
    console.error(error);
    showConfigWithError('Cannot load configuration', error);
    return null;
  }
  const history = JSON.parse(localStorage.getItem('config-history') ?? '[]')
    .filter((url: string) => url !== configUrl);
  history.unshift(configUrl);
  localStorage.setItem('config-history', JSON.stringify(history));

  return parseConfig(inputConfig, configUrl);
}

const resizeObserver = new ResizeObserver(entries => {
  document.documentElement.style.setProperty('--win-height', `${entries[0].target.clientHeight - 1}px`);
});
resizeObserver.observe(document.getElementById('content')!);

document.addEventListener('click', () => {
  document.getElementById('interaction-required')!.classList.add('hidden');
}, {once: true});

async function start() {
  const history = JSON.parse(localStorage.getItem('config-history') ?? '[]');
  history.forEach((url: string) => {
    const link = configHistory
      .appendChild(document.createElement('li'))
      .appendChild(document.createElement('a'));
    link.text = url;
    link.href = `/?config=${encodeURIComponent(url)}`;
  })

  const config = await loadConfig();
  if (config === null) return;
  await run(config);
}

start().catch(console.error);

