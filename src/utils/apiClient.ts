import {store} from '../store/store';
import {inspectionApi} from '../store/services/inspectionApi';

const safeStringify = (val: any) => {
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
};

const summarizeData = (data: any) => {
  if (data instanceof FormData) {
    const summary: Record<string, any> = {};
    if (typeof (data as any).forEach === 'function') {
      (data as any).forEach((val: any, key: string) => {
        if (val && typeof val === 'object' && 'uri' in val) {
          summary[key] = {
            uri: (val as any).uri,
            name: (val as any).name,
            type: (val as any).type,
            size: (val as any).fileSize || (val as any).size,
          };
        } else {
          summary[key] = val;
        }
      });
    } else if (Array.isArray((data as any)._parts)) {
      (data as any)._parts.forEach((pair: any[]) => {
        const [key, val] = pair;
        if (val && typeof val === 'object' && 'uri' in val) {
          summary[key] = {
            uri: (val as any).uri,
            name: (val as any).name,
            type: (val as any).type,
            size: (val as any).fileSize || (val as any).size,
          };
        } else {
          summary[key] = val;
        }
      });
    }
    return {type: 'FormData', fields: summary};
  }
  if (data === undefined) return undefined;
  if (data === null) return null;
  if (typeof data === 'object') {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return {...data};
    }
  }
  return data;
};

const runRequest = async (args: any) => {
  const state = store.getState();
  console.log('[API] Request', {
    method: (args.method || 'get').toUpperCase(),
    url: `${args.url || ''}`,
    hasToken: !!(state as any)?.auth?.token,
    params: args.params,
    payload: summarizeData(args.body),
    payloadString: safeStringify(summarizeData(args.body)),
  });

  const action = inspectionApi.endpoints.rawRequest.initiate({
    url: args.url,
    method: args.method || 'GET',
    params: args.params,
    body: args.body,
    headers: args.headers,
  });
  const result = await store.dispatch(action).unwrap().catch((err: any) => {
    console.error('[API] Response error', {
      message: err?.message || err,
      url: args.url,
      params: args.params,
      payload: summarizeData(args.body),
      payloadString: safeStringify(summarizeData(args.body)),
    });
    throw err;
  });
  return {data: result};
};

export const client = {
  get: (url: string, config?: {params?: any; headers?: any}) =>
    runRequest({url, method: 'GET', params: config?.params, headers: config?.headers}),
  post: (url: string, data?: any, config?: {params?: any; headers?: any}) =>
    runRequest({
      url,
      method: 'POST',
      body: data,
      params: config?.params,
      headers: config?.headers,
    }),
};
