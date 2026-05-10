import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "react/no-children-prop": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
