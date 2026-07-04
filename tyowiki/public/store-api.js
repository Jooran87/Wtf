'use strict';
// Datakerros PALVELINVERSIOLLE: puhuu REST-rajapinnalle (Node + SQLite).
// Sandbox-versio korvaa tämän tiedoston omalla localStorage-toteutuksellaan,
// mutta tarjoaa saman `Store`-rajapinnan, joten app.js pysyy samana.

async function api(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = 'Virhe';
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function jsonBody(method, obj) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

function withAttachmentUrls(page) {
  page.attachments.forEach((a) => { a.url = '/api/attachments/' + a.id; });
  return page;
}

const Store = {
  mode: 'server',

  categories: {
    list: () => api('/api/categories'),
    create: (name) => api('/api/categories', jsonBody('POST', { name })),
    rename: (id, name) => api('/api/categories/' + id, jsonBody('PUT', { name })),
    remove: (id) => api('/api/categories/' + id, { method: 'DELETE' }),
  },

  contacts: {
    list: () => api('/api/contacts'),
    create: (data) => api('/api/contacts', jsonBody('POST', data)),
    update: (id, data) => api('/api/contacts/' + id, jsonBody('PUT', data)),
    remove: (id) => api('/api/contacts/' + id, { method: 'DELETE' }),
  },

  pages: {
    list: (categoryId) => api('/api/pages' + (categoryId ? '?category_id=' + categoryId : '')),
    popular: (limit = 10) => api('/api/pages/popular?limit=' + limit),
    get: (id, { track } = {}) => api('/api/pages/' + id + (track ? '?track=1' : '')).then(withAttachmentUrls),
    create: (data) => api('/api/pages', jsonBody('POST', data)),
    update: (id, data) => api('/api/pages/' + id, jsonBody('PUT', data)),
    remove: (id) => api('/api/pages/' + id, { method: 'DELETE' }),
    revisions: (id) => api('/api/pages/' + id + '/revisions'),
    verify: (id, author) => api('/api/pages/' + id + '/verify', jsonBody('POST', { author })),
  },

  revisions: {
    get: (id) => api('/api/revisions/' + id),
  },

  terms: {
    list: () => api('/api/terms'),
    create: (data) => api('/api/terms', jsonBody('POST', data)),
    update: (id, data) => api('/api/terms/' + id, jsonBody('PUT', data)),
    remove: (id) => api('/api/terms/' + id, { method: 'DELETE' }),
  },

  announcements: {
    list: (limit) => api('/api/announcements' + (limit ? '?limit=' + limit : '')),
    create: (data) => api('/api/announcements', jsonBody('POST', data)),
    update: (id, data) => api('/api/announcements/' + id, jsonBody('PUT', data)),
    remove: (id) => api('/api/announcements/' + id, { method: 'DELETE' }),
  },

  attachments: {
    upload: (pageId, files, author) => {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      fd.append('author', author);
      return api('/api/pages/' + pageId + '/attachments', { method: 'POST', body: fd });
    },
    remove: (id) => api('/api/attachments/' + id, { method: 'DELETE' }),
  },

  notes: {
    list: ({ categoryId, limit } = {}) => {
      const p = new URLSearchParams();
      if (categoryId) p.set('category_id', categoryId);
      if (limit) p.set('limit', limit);
      return api('/api/shift-notes?' + p.toString());
    },
    create: (data) => api('/api/shift-notes', jsonBody('POST', data)),
    remove: (id) => api('/api/shift-notes/' + id, { method: 'DELETE' }),
  },

  search: (q) => api('/api/search?q=' + encodeURIComponent(q)).then((r) => {
    r.files.forEach((f) => { f.url = '/api/attachments/' + f.id; });
    return r;
  }),
};
