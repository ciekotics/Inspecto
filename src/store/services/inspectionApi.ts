import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react';

const appendFileToFormData = async (
  fd: FormData,
  fieldName: string,
  uri: string,
) => {
  const ext = uri.split('.').pop() || 'jpg';
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'jpeg' || ext === 'jpg'
      ? 'image/jpeg'
      : 'application/octet-stream';
  const isRemote = uri.startsWith('http://') || uri.startsWith('https://');
  if (isRemote) {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const typedBlob =
        blob.type && blob.type.length > 0
          ? blob
          : new Blob([blob], {type: mime || 'application/octet-stream'});
      (typedBlob as any).name = `${fieldName}.${ext}`;
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
    name: `${fieldName}.${ext}`,
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
        fd.append(
          'Reports',
          JSON.stringify({
            Report: args.items.map(it => ({
              'Defect image': '',
              Remark: it.remark || '',
            })),
          }),
        );
        fd.append('deletedFiles', JSON.stringify(args.deletedFiles || []));

        for (let i = 0; i < args.items.length; i += 1) {
          const uri = args.items[i].uri;
          if (uri) {
            await appendFileToFormData(fd, `defect[${i + 1}]`, uri);
          }
        }

        const result = await baseQuery({
          url: '/api/add-defect-inspection',
          method: 'POST',
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
        return {data: result.data};
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
