/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
module.exports = {
  schemaFile: './swagger.json',
  apiFile: '../src/api/baseApi.ts',
  apiImport: 'baseApi',
  outputFile: '../src/api/endpoints.ts',
  exportName: 'api',
  hooks: true,
  tag: true,
  flattenArg: true,
  // POST endpoints the storefront reads like data (cached, refetched on arg
  // change), not fire-and-forget writes. Without this the generator infers
  // mutations from the HTTP method and the hooks become use…Mutation.
  endpointOverrides: [
    { pattern: ['quoteBasket', 'viewCustomerOrder'], type: 'query' },
  ],
};
