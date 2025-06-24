const nodemailer = require("nodemailer");

const sendEmail = async (email, subject, textOrHtml) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: subject,
            html: textOrHtml,
        });
        console.log("Email sent successfully");
    } catch (error) {
        console.log("Email not sent");
        console.log(error);
    }
};

module.exports = sendEmail;