const ejs = require("ejs");
const path = require("path");

// Path to email templates directory
const TEMPLATES_DIR = path.join(__dirname, "../views/emails");
const LAYOUTS_DIR = path.join(TEMPLATES_DIR, "layouts");

/**
 * Render an EJS email template with the base layout
 * @param {string} templateName - Name of the template file (without .ejs extension)
 * @param {Object} data - Data to pass to the template
 * @param {string} data.title - Email title (used in base layout)
 * @returns {Promise<string>} - Rendered HTML string
 */
const renderTemplate = async (templateName, data = {}) => {
  try {
    // First, render the content template
    const contentPath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
    const content = await ejs.renderFile(contentPath, data);

    // Then, render the base layout with the content
    const layoutPath = path.join(LAYOUTS_DIR, "base.ejs");
    const html = await ejs.renderFile(layoutPath, {
      ...data,
      content,
    });

    return html;
  } catch (error) {
    console.error(`Error rendering email template "${templateName}":`, error);
    throw new Error(`Failed to render email template: ${templateName}`);
  }
};

/**
 * Convert HTML to plain text
 * Strips HTML tags and normalizes whitespace for email clients that don't support HTML
 * @param {string} html - HTML string to convert
 * @returns {string} - Plain text string
 */
const htmlToText = (html) => {
  return html
    // Remove style and script tags with their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Replace <br> and <br/> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace </p>, </div>, </tr>, </li> with double newlines
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n\n")
    // Replace </td> with tab
    .replace(/<\/td>/gi, "\t")
    // Replace <li> with bullet point
    .replace(/<li[^>]*>/gi, "  - ")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&copy;/gi, "(c)")
    // Normalize whitespace
    .replace(/[ \t]+/g, " ")
    // Remove excessive newlines (more than 2)
    .replace(/\n{3,}/g, "\n\n")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // Final trim
    .trim();
};

/**
 * Render email template and return both HTML and plain text versions
 * @param {string} templateName - Name of the template file (without .ejs extension)
 * @param {Object} data - Data to pass to the template
 * @returns {Promise<{html: string, text: string}>} - Rendered HTML and text versions
 */
const renderEmail = async (templateName, data = {}) => {
  const html = await renderTemplate(templateName, data);
  const text = htmlToText(html);

  return { html, text };
};

module.exports = {
  renderTemplate,
  renderEmail,
  htmlToText,
};
