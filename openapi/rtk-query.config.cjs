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
  // (submitContentReport is hand-written in src/api/reportEndpoints.ts, not generated.)
  // Only generate what the storefront calls; the spec also has the whole admin
  // surface, which would otherwise ship in the storefront bundle. Re-derive from
  // `use…Query/Mutation` usages under src/ when adding a new call.
  filterEndpoints: [
    'listPublicShops',
    'getPlatformLegal',
    'getShopBySlug',
    'getShopById',
    'getCatalog',
    'getPublicLegalPack',
    'viewCustomerOrder',
    'cancelCustomerOrder',
    'viewCustomerDocument',
    'createOrder',
    'quoteBasket',
  ],
  // POST endpoints the storefront reads like data (cached, refetched on arg
  // change), not fire-and-forget writes. Without this the generator infers
  // mutations from the HTTP method and the hooks become use…Mutation.
  endpointOverrides: [
    { pattern: ['quoteBasket', 'viewCustomerOrder'], type: 'query' },
  ],
};
