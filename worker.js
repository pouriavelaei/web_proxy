export default {
  async fetch(request) {
    return Response.redirect("https://www.google.com", 301);
  }
};
