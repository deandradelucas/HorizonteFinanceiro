fetch('https://horizonte-financeiro-one.vercel.app/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'testpassword123' })
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
