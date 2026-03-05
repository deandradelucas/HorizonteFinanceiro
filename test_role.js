// test_role.js
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    console.log('Roles permitidas:', allowedRoles);
    next();
  };
}

// Teste rápido
const middleware = authorizeRole(['super_admin']);
middleware({ user: { role: 'super_admin' } }, null, () => {
  console.log('Middleware passou!');
});