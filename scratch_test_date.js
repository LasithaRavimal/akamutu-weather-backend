const date = new Date('invalid_date_string');
console.log(!date); // false, because it's an object
try {
  date.toISOString();
} catch (e) {
  console.error('Caught error:', e.name, e.message);
}
