import '@datahub/ui/foundations/global.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { readConfig } from './lib/config.js';

mount(App, { target: document.getElementById('app') as HTMLElement, props: { config: readConfig(document) } });
