// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const BASIC_USER = "admin";
    const BASIC_PASS = "admin";
    const url = request.url;
    function getParameterByName(name) {
      name = name.replace(/[\[\]]/g, "\\$&");
      name = name.replace(/\//g, "");
      var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
      if (!results)
        return null;
      else if (!results[2])
        return "";
      else if (results[2]) {
        results[2] = results[2].replace(/\//g, "");
      }
      return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
    function rawHtmlResponse(html) {
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8"
        }
      });
    }
    async function verifyCredentials(user, pass) {
      if (BASIC_USER !== user) {
        throw new UnauthorizedException("Invalid credentials.");
      }
      if (BASIC_PASS !== pass) {
        throw new UnauthorizedException("Invalid credentials.");
      }
    }
    async function basicAuthentication(request2) {
      const Authorization = request2.headers.get("Authorization");
      const [scheme, encoded] = Authorization.split(" ");
      if (!encoded || scheme !== "Basic") {
        throw new BadRequestException("Malformed authorization header.");
      }
      const buffer = Uint8Array.from(
        atob(encoded),
        (character) => character.charCodeAt(0)
      );
      const decoded = new TextDecoder().decode(buffer).normalize();
      const index = decoded.indexOf(":");
      if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        throw new BadRequestException("Invalid authorization value.");
      }
      return {
        user: decoded.substring(0, index),
        pass: decoded.substring(index + 1)
      };
    }
    async function UnauthorizedException(reason) {
      this.status = 401;
      this.statusText = "Unauthorized";
      this.reason = reason;
    }
    async function BadRequestException(reason) {
      this.status = 400;
      this.statusText = "Bad Request";
      this.reason = reason;
    }
    const { host, protocol, pathname } = new URL(request.url);
    if ("https:" !== protocol || "https" !== request.headers.get("x-forwarded-proto")) {
      throw new BadRequestException("Please use a HTTPS connection.");
    }
    switch (pathname) {
      case "/setup/home":
        return new Response(`Cloudflare KV Namespace
Redirectory

This worker manages philamb.info redirect KV namespace

Sitemap
  PUBLIC
    \u2514 /setup/home - Welcome Page (you are here!)
    \u2514 /setup/login - Head here to auth in browser. Or, use Basic Auth in an HTTP header
    \u2514 /setup/logout - When you're finished head here to end your session
    \u2514 /* - Anything not defined by this Worker will go to the redirect KV Namespace
  AUTH REQUIRED
    \u2514 /setup/list - GET content of the Redirectory
    \u2514 /setup/form - UI form for interacting with KV namespace values
    \u2514 /setup/update - GET values in the redirectory if the value exists, send an error and ask for OW
	  \u2514 Usage - /update?key={key}&value={value} add &ow=1 if the request returns 409 Conflict`);
      case "/setup/logout":
        return new Response("Logged out.", { status: 401 });
      case "/setup/login": {
        if (request.headers.has("Authorization")) {
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);
          console.log(host);
          return Response.redirect("https://" + host + "/setup/home", 301);
        }
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"'
          }
        });
      }
      case "/setup/list": {
        if (request.headers.has("Authorization")) {
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);
          const value = await env.NAMESPACE.list();
          return new Response(JSON.stringify(value.keys), {
            status: 200,
            headers: {
              "Cache-Control": "no-store"
            }
          });
        }
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"'
          }
        });
      }
      case "/setup/update": {
        if (request.headers.has("Authorization")) {
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);
          var queryKey = "/" + getParameterByName("key");
          var queryValue = getParameterByName("value");
          var queryOW = getParameterByName("ow") === "1";
          const value = await env.NAMESPACE.get(queryKey);
          if (queryKey === null && queryValue === null) {
            return new Response(`No values set for key or value!
		
Usage - /update?key={key}&value={value} add &ow=1 if the request returns 409 Conflict`, { status: 400 });
          }
          if (!(value === null) && !queryOW) {
            return new Response(`Value exists for ${queryKey}. Select OverWrite to confirm update.`, { status: 409 });
          }
          if (!(value === null) && queryOW) {
            await env.NAMESPACE.put(queryKey, "https://" + queryValue);
            return new Response(`Value for ${queryKey} OverWritten!`, { status: 200 });
          }
          if (value === null) {
            await env.NAMESPACE.put(queryKey, "https://" + queryValue);
            return new Response(`Value not found. Inserting ${queryKey}::${queryValue} into Redirectory.`, { status: 201 });
          }
        }
      }
      case "/setup/form": {
        if (request.headers.has("Authorization")) {
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);
          return rawHtmlResponse(`<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf8" />
            <title>Form Demo</title>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
			
			<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3/dist/css/bootstrap.min.css">
			<style>
			  .gradient-custom {
				 /* fallback for old browsers */
				 background: #6a11cb;

				 /* Chrome 10-25, Safari 5.1-6 */
				 background: -webkit-linear-gradient(to right, rgba(106, 17, 203, 1), rgba(37, 117, 252, 1));

				 /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */
				 background: linear-gradient(to right, rgba(106, 17, 203, 1), rgba(37, 117, 252, 1))
			  }
			</style>
          </head>
          <body>
			<section class="vh-100 gradient-custom">
			  <div class="container py-5 h-100">
				<div class="row d-flex justify-content-center align-items-center h-100">
				  <div class="col-12 col-md-8 col-lg-6 col-xl-5">
					<div class="card bg-dark text-white" style="border-radius: 1rem;">
					  <div class="card-body p-5 text-center">
						<form id="updateForm">
						  <div id="response">Fill out this form and hit sumbit to insert a new redirect record. If one exists, you will be prompted to overwrite.</div>
						  <br>
						  <div class="form-outline form-white mb-4">
							<label for="key"> Key</label>
							<input class="form-control form-control-lg" id="key" name="key" type="text" placeholder='example' />
						  </div>
						  <div class="form-outline form-white mb-4">
							<label for="value"> Value (https:// not necessary) </label>
							<input class="form-control form-control-lg" id="value" name="value" type="value" placeholder='example.org'/>
						  </div>
						  <div class="input">
							<label class="form-check-label" for="ow"> OverWrite Data</label>
							<input class="form-check-input" type="checkbox" id="ow" name="ow" value="1">
						  </div>
						  <br>
						  <button form="updateForm" class="btn btn-outline-light btn-lg px-5" onclick="submitForm();" type="button">Submit</button>
						</form>
					  </div>
					</div>
				  </div>
				</div>
			  </div>
			</section>
          <script>
            function submitForm() {
              var xhr = new XMLHttpRequest();

              key = document.getElementById('key').value
              value = document.getElementById('value').value
              ow = document.getElementById('ow').checked ? 1 : 0
          
              xhr.open("GET", "/setup/update?key=" + key + "&value=" + value + "&ow=" + ow, true);
              xhr.setRequestHeader('Authorization', 'Basic YWRtaW46YWRtaW4=');

              xhr.onreadystatechange = function() {
                document.getElementById("response").innerHTML =
                  this.responseText;
              };

              xhr.send();
            }
          <\/script>
          </body>
        </html>
        `);
        }
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"'
          }
        });
      }
      case "/favicon.ico":
      case "/robots.txt":
        return new Response(null, { status: 204 });
    }
    const redirectURL = await env.NAMESPACE.get(pathname);
    if (!redirectURL) {
      return new Response("Not Found.", { status: 404 });
    }
    return Response.redirect(redirectURL, 301);
  }
};

export {
  src_default as default
};