//Functions relating to the error message
class Error{
    //Retrieve the location of the error bar on the page
    static initialize(){
        this.errorMessage = document.getElementById('errorMessage');
    }

    //Display the error
    static throw(){
        this.lastThrow = new Date();
        this.errorMessage.style.visibility = 'visible';
        setTimeout(() => {
            const now = new Date();

            //If a new error has not been thrown within the last 5 seconds, hide the error bar
            if(now - this.lastThrow >= 4990) this.hide();
        }, 5000);
    }

    //Hide the error
    static hide(){
        this.errorMessage.style.visibility = 'hidden';
    }
}

//Functions relating to logging in
class LoginMain{
    //Initializging methods for this
    static initialize(){
        this.socket = io();

        this.authenticateLogin();
        this.sockets();
        this.scripts();
    }

    //Receiving data from server
    static sockets(){
        this.socket.on('badLogin', () => { Error.throw() });
        
        this.socket.on('loggedIn', data => {
            
            //If the login is good, set the appropriate cookie
            document.cookie = `${data.username} ${data.password}`;
            window.location.href = '/';
        });

        //If the user is already logged in, redirect them to the home page (shopping List)
        this.socket.on('loginAuthenticated', data => {
            if(data.success === true) window.location.href = '/';
        });
    }

    //See if the user is already logged in by some chance
    static authenticateLogin(){
        this.sendData('authenticateLogin', {credentials: document.cookie});
    }

    //Functionality of inputs
    static scripts(){
        this.submit = document.getElementById('submit');
        this.username = document.getElementById('username');
        this.password = document.getElementById('password');

        this.submit.addEventListener('click', () => {
            this.sendData('loginAttempt', {
                username: this.username.value,
                password: this.password.value
            });
        });
    }

    //Sending data with server
    static sendData(request, data){
        this.socket.emit(request, data);
    }
}

//Error.initialize();
LoginMain.initialize();
Error.initialize();