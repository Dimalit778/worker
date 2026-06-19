import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
  type Query,
} from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export function dehydrateOptions() {
  return {
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
  };
}
