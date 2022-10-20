import handlebars from 'vite-plugin-handlebars';
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [handlebars({
    context: {
      smallButtons: ['red', 'orange', 'yellow', 'green', 'blue', 'white', 'black'],
    },
  })],
});
