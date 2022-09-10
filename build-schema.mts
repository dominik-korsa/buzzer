import fse from 'fs-extra';
import { configSchema } from "./src/config-schema.js";
import * as path from "path";

const output = path.join(process.cwd(), 'dist/schema.json');
fse.ensureDirSync(path.dirname(output));
fse.writeFileSync(output, JSON.stringify(configSchema, null, 2));
