import eslintBase from "./eslint.config.base.mjs";

export default [
  {
    files: ["{src,test}/**/*.{js,ts,yaml,yml,json}"],
  },
  {
    ignores: ["lib/**/*", "*.ts", "apiDoc/**/*", "apiDoc/*", "dist/*"],
  },
  ...eslintBase,
];