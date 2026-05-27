const axios = require("axios");

const sendWhatsApp = async (phone, message) => {
  const formatted = phone.replace(/[\s\-\+]/g, "");

  const response = await axios.post(
    `${process.env.WHAPI_URL}/messages/text`,
    {
      to: formatted,
      body: message,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHAPI_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

module.exports = { sendWhatsApp };