export const driverLogin = async (email: string, password: string) => {
  const response = await fetch("http://10.43.239.185:8080/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: email,
      password: password,
    }),
  });

  const text = await response.text();
  console.log("RAW RESPONSE:", text);

  let data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(text);
  }

  if (!response.ok) {
    throw new Error(data.message || text);
  }

  return data;
};