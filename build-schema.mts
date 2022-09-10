import fse from 'fs-extra';
import { fullConfigSchema } from "./src/config-schema.js";
import * as path from "path";
import beautify from 'json-beautify';

const output = path.join(process.cwd(), 'dist/schema.json');
fse.ensureDirSync(path.dirname(output));
fse.writeFileSync(output, beautify(fullConfigSchema, null as any, 2, 80));
