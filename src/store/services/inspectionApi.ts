import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react';

const headersToObject = (headers: any) => {
  const obj: Record<string, string> = {};
  if (!headers) {
    return obj;
  }
  try {
    if (typeof headers.forEach === 'function') {
      headers.forEach((value: string, key: string) => {
        obj[key] = value;
      });
      return obj;
    }
    if (typeof headers.entries === 'function') {
      for (const [key, value] of headers.entries()) {
        obj[key as string] = String(value);
      }
      return obj;
    }
    if ((headers as any).map && typeof (headers as any).map === 'object') {
      return {...(headers as any).map};
    }
  } catch (err) {
    console.warn('[inspectionApi] failed to normalize headers', err);
  }
  return obj;
};

const appendFileToFormData = async (
  fd: FormData,
  fieldName: string,
  uri: string,
  fileNameBase?: string,
) => {
  const ext = uri.split('.').pop() || 'jpg';
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'jpeg' || ext === 'jpg'
      ? 'image/jpeg'
      : 'application/octet-stream';
  const baseName = fileNameBase || fieldName;
  const fileName = `${baseName}.${ext}`;
  const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
  if (isRemote) {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: mime || 'application/octet-stream'});
      (typedBlob as any).name = fileName;
      fd.append(fieldName, typedBlob as any);
      return;
    } catch (err) {
      console.warn('[inspectionApi] failed to fetch remote image, fallback to uri', err);
    }
  }
  const normalizedUri =
    uri.startsWith('file://') || uri.startsWith('content://') ? uri : uri;
  fd.append(fieldName, {
    uri: normalizedUri,
    name: fileName,
    type: mime,
  } as any);
};

export const inspectionApi = createApi({
  reducerPath: 'inspectionApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.marnix.in',
    prepareHeaders: (headers, {getState}) => {
      const token = (getState() as any)?.auth?.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Inspection', 'Defects'],
  endpoints: builder => ({
    getInspection: builder.query<any, {sellCarId: string}>({
      query: ({sellCarId}) => ({
        url: '/api/view-inspection',
        params: {sellCarId},
      }),
      providesTags: ['Inspection'],
    }),
    getDefects: builder.query<any, {sellCarId: string}>({
      query: ({sellCarId}) => ({
        url: '/api/view-defects-inspection',
        params: {sellCarId},
      }),
      providesTags: ['Defects'],
    }),
    addDefects: builder.mutation<
      any,
      {
        sellCarId: string;
        inspectionId: string | number;
        items: {uri: string | null; remark: string}[];
        deletedFiles: string[];
      }
    >({
      async queryFn(args, _api, _extra, baseQuery) {
        const fd = new FormData();
        fd.append('id', String(args.inspectionId || args.sellCarId));
        fd.append('sellCarId', args.sellCarId);
        const reportsList = args.items.map(it => {
          const isRemote =
            typeof it.uri === 'string' &&
            (it.uri.startsWith('http://') || it.uri.startsWith('https://'));
          return {
            'Defect image': isRemote ? it.uri : '',
            Remark: typeof it.remark === 'string' ? it.remark : '',
          };
        });
        const reportsPayload = {Report: reportsList};
        const reportsJson = JSON.stringify(reportsPayload);
        fd.append('Reports', reportsJson);
        fd.append(
          'deletedFiles',
          JSON.stringify((args.deletedFiles || []).filter(Boolean)),
        );

        const appendedFiles: string[] = [];
        for (let i = 0; i < args.items.length; i += 1) {
          const uri = args.items[i].uri;
          const isRemote =
            typeof uri === 'string' &&
            (uri.startsWith('http://') || uri.startsWith('https://'));
          if (uri && !isRemote) {
            // Match web app behavior: field name defect[<idx>] but file name defect<idx>.ext
            await appendFileToFormData(fd, `defect[${i + 1}]`, uri, `defect${i + 1}`);
            appendedFiles.push(`defect[${i + 1}]`);
          }
        }

        console.log('[inspectionApi/addDefects] payload', {
          id: String(args.inspectionId || args.sellCarId),
          sellCarId: args.sellCarId,
          reportsPayload: reportsPayload,
          reportsJson,
          deletedFiles: (args.deletedFiles || []).filter(Boolean),
          appendedFiles,
          itemsSummary: args.items.map(it => ({
            hasUri: !!it.uri,
            isRemote:
              typeof it.uri === 'string' &&
              (it.uri.startsWith('http://') || it.uri.startsWith('https://')),
            remarkLength: (it.remark || '').length,
          })),
        });

        const result = await baseQuery({
          url: '/api/add-defect-inspection',
          method: 'POST',
          headers: {'Accept': '*/*'},
          body: fd,
        });
        if (result.error) {
          return {error: result.error};
        }
        return {data: result.data};
      },
      invalidatesTags: ['Defects'],
    }),
    rawRequest: builder.mutation<
      any,
      {url: string; method?: string; params?: any; body?: any; headers?: any}
    >({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const result = await baseQuery({
          url: arg.url,
          method: arg.method || 'GET',
          params: arg.params,
          body: arg.body,
          headers: arg.headers,
        });
        if (result.error) {
          return {error: result.error};
        }
        const headers = headersToObject((result.meta as any)?.response?.headers);
        return {data: {body: result.data, headers}};
      },
    }),
  }),
});

export const {
  useGetInspectionQuery,
  useGetDefectsQuery,
  useAddDefectsMutation,
  useRawRequestMutation,
} = inspectionApi;
