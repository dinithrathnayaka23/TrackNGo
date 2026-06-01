export const driverLogin = async (email: string, password: string) => {
  const response = await fetch("http://10.233.234.185:8080/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ //means we are sending a json
      identifier: email,
      password: password,
    }),
  });

  const text = await response.text();
  console.log("Raw Response:", text);

  let data;

  try {
    data = JSON.parse(text); // This will convert the raw response text 
  } catch (e) {
    throw new Error(text); // If JSON parsing fails
  }

  if (!response.ok) { // if the raw response cause an error
    throw new Error(data.message || text); // response or msg
  }

  return data;
};