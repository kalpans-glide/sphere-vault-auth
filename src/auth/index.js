// -- dependencies --
// sphere-vault-auth
class SpherVaultAuth {


    // -- vars --
    // for handling the open-id client, token and user info
    // and for now the keycloak configurations


    // -- Keycloak Init -- Constructor
    // init the client i.e. Issuer
    // configure the local callback server url


    // -- keycloak dispose -- Destructor
    // dispose the keycloak client object and info if any
    // close the callback server if active

    // -- login -- public method
    // pkce flow 1st part - init // get the verifier and all
    // generate the url based on this
    // start the local callback server
    /// Inside the promise
    // handler A - listen to callback server and handle the response inclusive of pkce 2nd part
    // open the browser to the keycloak login page
    // handler A - store the token if success(accesing the user info), close the callback server
    /// resolve/reject the promise when the callback is received


    // -- logout -- public method
    // if token exists - dispose the token
    // open logout page - keycloak logout
    // else - do nothing - show No Active Session

}
// -- export -- export the class

