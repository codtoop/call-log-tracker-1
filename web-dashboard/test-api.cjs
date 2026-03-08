async function main() {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "Toufik", password: "password" })
    });
    const loginData = await loginRes.json();
    console.log("Login:", loginData);

    const token = loginData.token;

    const logsRes = await fetch('http://localhost:3000/api/logs?limit=10&page=1', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const logsData = await logsRes.json();
    console.log("Logs count:", logsData.logs ? logsData.logs.length : "none");
    console.log("Response:", JSON.stringify(logsData, null, 2));
}
main();
