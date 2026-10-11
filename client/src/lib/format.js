export const CATEGORIES = ['concert', 'sports', 'theatre', 'comedy', 'conference', 'festival', 'other'];

export const formatPrice = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export const formatDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatShortDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
