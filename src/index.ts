export default {
  async fetch(request, env, ctx) {
    const BASIC_USER = "admin";
    const BASIC_PASS = "admin";
	const url = request.url

	// Function to parse query strings
	function getParameterByName(name) {
		name = name.replace(/[\[\]]/g, '\\$&')
		name = name.replace(/\//g, '')
		var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
			results = regex.exec(url)

		if (!results) return null
		else if (!results[2]) return ''
		else if (results[2]) {
			results[2] = results[2].replace(/\//g, '')
		}
		
		return decodeURIComponent(results[2].replace(/\+/g, ' '));
	}

  // The rest of this snippet for the demo page
  function rawHtmlResponse(html) {
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }

    /**
     * Throws exception on verification failure.
     * @param {string} user
     * @param {string} pass
     * @throws {UnauthorizedException}
     */
    async function verifyCredentials(user, pass) {
      if (BASIC_USER !== user) {
        throw new UnauthorizedException("Invalid credentials.");
      }

      if (BASIC_PASS !== pass) {
        throw new UnauthorizedException("Invalid credentials.");
      }
    }

    /**
     * Parse HTTP Basic Authorization value.
     * @param {Request} request
     * @throws {BadRequestException}
     * @returns {{ user: string, pass: string }}
     */
    async function basicAuthentication(request) {
      const Authorization = request.headers.get("Authorization");

      const [scheme, encoded] = Authorization.split(" ");

      // The Authorization header must start with Basic, followed by a space.
      if (!encoded || scheme !== "Basic") {
        throw new BadRequestException("Malformed authorization header.");
      }

      // Decodes the base64 value and performs unicode normalization.
      // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
      // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
      const buffer = Uint8Array.from(atob(encoded), (character) =>
        character.charCodeAt(0)
      );
      const decoded = new TextDecoder().decode(buffer).normalize();

      // The username & password are split by the first colon.
      //=> example: "username:password"
      const index = decoded.indexOf(":");

      // The user & password are split by the first colon and MUST NOT contain control characters.
      // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
      if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        throw new BadRequestException("Invalid authorization value.");
      }

      return {
        user: decoded.substring(0, index),
        pass: decoded.substring(index + 1),
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

    const { protocol, pathname } = new URL(request.url);

    // In the case of a Basic authentication, the exchange MUST happen over an HTTPS (TLS) connection to be secure.
    if (
      "https:" !== protocol ||
      "https" !== request.headers.get("x-forwarded-proto")
    ) {
      throw new BadRequestException("Please use a HTTPS connection.");
    }

    switch (pathname) {
      case "/":
        return new Response(`Indian Hills Community College
Redirectory

This worker manages ihcc.edu redirect KV namespace

Sitemap
  PUBLIC
    └ / - Welcome Page (you are here!)
    └ /login - Head here to auth in browser. Or, use Basic Auth in an HTTP header
    └ /logout - When you're finished head here to end your session
  AUTH REQUIRED
    └ /list - GET content of the Redirectory
    └ /form - UI form for interacting with KV namespace values
    └ /update - GET values in the redirectory if the value exists, send an error and ask for OW
	  └ Usage - /update?key={key}&value={value} add &ow=1 if the request returns 409 Conflict`);

      case "/logout":
        // Invalidate the "Authorization" header by returning a HTTP 401.
        // We do not send a "WWW-Authenticate" header, as this would trigger
        // a popup in the browser, immediately asking for credentials again.
        return new Response("Logged out.", { status: 401 });

      case "/login": {
        // The "Authorization" header is sent when authenticated.
        if (request.headers.has("Authorization")) {
          // Throws exception when authorization fails.
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);

          // Only returns this response when no exception is thrown.
          return Response.redirect('https://update-shorty.ihcc.workers.dev', 301);
        }

        // Not authenticated.
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"',
          },
        });
      }

      case "/list": {
        // The "Authorization" header is sent when authenticated.
        if (request.headers.has("Authorization")) {
          // Throws exception when authorization fails.
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);

          const value = await env.NAMESPACE.list();

          // Only returns this response when no exception is thrown.
          return new Response(JSON.stringify(value.keys), {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
            },
          });
        }

        // Not authenticated.
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"',
          },
        });
      }

      case "/update": {
        // The "Authorization" header is sent when authenticated.
        if (request.headers.has("Authorization")) {
          // Throws exception when authorization fails.
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);
		  
          // Usage example
          var queryKey = "/" + getParameterByName('key')
          var queryValue = getParameterByName('value')
          var queryOW = getParameterByName('ow') === "1"

          const value = await env.NAMESPACE.get(queryKey)

          //  If the query wasn't formatted properly reject the request
          if(queryKey === null && queryValue === null) {
            return new Response(`No values set for key or value!
		
Usage - /update?key={key}&value={value} add &ow=1 if the request returns 409 Conflict`,{status:400})
		      }

          //  Value exists and OverWrite is necessary
          if (!(value === null) && !queryOW ) {
            return new Response(`Value exists for ${queryKey}. Select OverWrite to confirm update.`, {status: 409})
          }

          //  Value exists and OverWrite is set
          if (!(value === null) && queryOW) {
            await env.NAMESPACE.put(queryKey, 'https://' + queryValue)
            return new Response(`Value for ${queryKey} OverWritten!`, {status: 200})
          }

          //  Value does not exists, okay to Write
          if (value === null) {
            await env.NAMESPACE.put(queryKey, 'https://' + queryValue)
            return new Response(`Value not found. Inserting ${queryKey}::${queryValue} into Redirectory.`, { status: 201 })
          }         
        }
      }

      case "/form": {
        // The "Authorization" header is sent when authenticated.
        if (request.headers.has("Authorization")) {
          // Throws exception when authorization fails.
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
          
              xhr.open("GET", "/update?key=" + key + "&value=" + value + "&ow=" + ow, true);
              xhr.setRequestHeader('Authorization', 'Basic YWRtaW46YWRtaW4=');

              xhr.onreadystatechange = function() {
                document.getElementById("response").innerHTML =
                  this.responseText;
              };

              xhr.send();
            }
          </script>
          </body>
        </html>
        `);  
        }

        // Not authenticated.
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"',
          },
        });
      }

      case "/admin": {
        // The "Authorization" header is sent when authenticated.
        if (request.headers.has("Authorization")) {
          // Throws exception when authorization fails.
          const { user, pass } = basicAuthentication(request);
          verifyCredentials(user, pass);

          // Only returns this response when no exception is thrown.
          return new Response("You have private access.", {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
            },
          });
        }

        // Not authenticated.
        return new Response("You need to login.", {
          status: 401,
          headers: {
            // Prompts the user for credentials.
            "WWW-Authenticate": 'Basic realm="ihcc-worker", charset="UTF-8"',
          },
        });
      }

      case "/favicon.ico":
      case "/robots.txt":
        return new Response(null, { status: 204 });
    }

    return new Response("Not Found.", { status: 404 });
  },
};