//This file is responsible for the working of the directory page

//The error class throws and hides errors
class Error{
    //Retrieve the location of the error bar on the page
    static initialize(){
        this.errorMessage = document.getElementById('errorMessage');
    }

    //Display the error
    static throw(text){
        this.lastThrow = new Date();
        this.errorMessage.classList.add('visible');
        this.errorMessage.innerText = text;
        setTimeout(() => {
            const now = new Date();

            //If a new error has not been thrown within the last 5 seconds, hide the error bar
            if(now - this.lastThrow >= 4990) this.hide();
        }, 5000);
    }

    //Hide the error
    static hide(){
        this.errorMessage.classList.remove('visible');
    }
}

//This class is responsible for adding scripts to objects on the webpage
class DirectoryScripts{
    //Call methods in this class
    static initialize(){
        this.addCategory();
        this.removeCategories();
        this.redirects();

        //This object is responsible for allowing the program to detect globally when a text input is entered
        this.textInputValue = {
            value: '',
            aListener: function(val) {},
            set a(newValue) {
              this.value = newValue;
              this.aListener(newValue);
            },
            get a() {
              return this.value;
            },
            awaitUpdate: function(update) {
              this.aListener = update;
            }
        }
    }

    //This method configures the working of adding a category
    static addCategory(){
        const addCategory = document.getElementById('addCategory');
        const textInput = document.getElementById('textInput');
        const hideWindow = document.getElementById('hideWindow');
        const inputWindow = document.getElementById('inputWindow');

        //When enter is pressed, accept the user's input
        textInput.addEventListener('keyup', keyPress => {
            if(keyPress.key === 'Enter'){
                inputWindow.style.display = 'none';
                this.textInputValue.a = textInput.value;
            }
        });
        
        //Display the window to add the category
        addCategory.addEventListener('click', () => {
            inputWindow.style.display = 'inline';

            //Wait until enter is pressed by the user
            this.textInputValue.awaitUpdate(name => {

                //Throw an error is the user's input is invalid
                if(name === '') Error.throw('Empty name');
                else if(name[0] === ' ') Error.throw('Cannot start with space');

                //Otherwise send a request to add the category to the server
                else DirectoryMain.sendData('addCategory', {category : name});
            });
        });

        //Makes the X button close the window
        hideWindow.addEventListener('click', () => {
            inputWindow.style.display = 'none';
        });
    }

    //Upon initialization this method calls the removeCategory method on all categories
    //This is necessary because a newly created category will have removeCategory called on it
    static removeCategories(){
        const blocks = document.getElementsByClassName('block');
        for(let block of blocks){
            this.removeCategory(block);
        }
    }

    //This method allows for the working of removing a category
    static removeCategory(block){
        //Function to detect a long click
        block.addEventListener('touchstart', tap => {
            tap.preventDefault();
            this.lastClick = new Date();
            block.classList.add('clicked');
            setTimeout(() => {
                var clickNow = new Date();

                //If something has been last clicked more that 3 seconds ago, send a request to
                //remove the category to the server
                if(clickNow - this.lastClick >= 2990)
                    DirectoryMain.sendData('removeCategory',
                        {category : block.lastElementChild.getAttribute('name')});
            }, 3000);
        });

        //If the user moves their finger off the block, the long click will not be registered
        block.addEventListener('touchend', tap => {
            tap.preventDefault();
            this.lastClick += 100000;
            block.classList.remove('clicked');
        });

        //Equivalent for click using mouse
        //Function to detect a long click
        block.addEventListener('mousedown', () => {
            this.lastClick = new Date();
            block.classList.add('clicked');
            setTimeout(() => {
                var clickNow = new Date();

                //If something has been last clicked more that 3 seconds ago, send a request to
                //remove the category to the server
                if(clickNow - this.lastClick >= 2990)
                    DirectoryMain.sendData('removeCategory',
                        {category : block.lastElementChild.getAttribute('name')});
            }, 3000);
        });

        //If the user moves their mouse/finger off the block, the long click will not be registered
        block.addEventListener('mouseup', () => {
            this.lastClick += 100000;
            block.classList.remove('clicked');
        });

        //If the user unpresses their mouse/finger, the long click will not be registered
        block.addEventListener('mouseout', () => {
            this.lastClick += 100000;
            block.classList.remove('clicked');
        });
    }

    //Upon initialization this method calls the redirect method on all categories
    static redirects(){
        const blocks = document.getElementsByClassName('block');
        for(let block of blocks){
            this.redirect(block);
        }
    }

    //This method allows for blocks to redirect to categories when pressed for a short duration
    static redirect(block){

        //This approach is necessary, 
        //because otherwise trying to long click the category will force a redirect
        block.addEventListener('mousedown', () => {
            
            //Mark the block as recently clicked for 0.2 seconds
            block.classList.add('recent');
            setTimeout(() => {
                block.classList.remove('recent');
            }, 200);
        });

        //If the blocks is marked as recently clicked when the user unpresses, trigger the redirect
        block.addEventListener('click', () => {
            if(block.classList.contains('recent'))
                window.location.href = `/category/${block.lastElementChild.getAttribute('name')}`;
        })
    }
}

//This class is responsible for logical processing and sending requests to the server
class DirectoryMain{
    //This methods calls other methods in this class
    static initialize(){
        this.socket = io();
        this.sockets();
    }

    //Initialize the sockets used for accepting requests from the server
    static sockets(){
        this.socket.on('errormsg', data => { Error.throw(data.errorMessage); });

        this.socket.on('addCategory', data => { this.addCategory(data.category); });

        this.socket.on('removeCategory', data => { this.removeCategory(data.category); });

        this.socket.on('updateImage', data => { this.updateImage(data); });
    }

    //Send data to the server
    static sendData(request, data){
        this.socket.emit(request, data);
    }

    //This method performs the action of displaying a new category in the directory
    static addCategory(name){
        //Create the HTML object
        const newCategory = document.createElement('li');
        newCategory.classList.add('block');
        newCategory.innerHTML = `<div id = 'loading'></div>
                                <span class = 'text' name = '${name}'>${name}</span>`;

        //Add scripts to this new HTML object
        DirectoryScripts.redirect(newCategory);
        DirectoryScripts.removeCategory(newCategory);
                                
        //Insert the new category in the alphabetically correct spot
        const categories = document.getElementById('categories');
        for(let category of categories.children){
            
            //If the next category's name is lexicographically smaller, insert the new product here
            if(name < category.lastElementChild.innerText){
                categories.insertBefore(newCategory, category);
                return;
            }
        }

        //If no such product was found, append the new category at the end of the list
        categories.appendChild(newCategory);
    }

    //This method removes a category of a provided name
    static removeCategory(name){
        const category = document.querySelector(`[name = '${name}']`);
        category.parentElement.remove();
    }

    //This method updates the image of a product with a given name
    static updateImage(data){
        const category = document.querySelector(`[name = '${data.category}']`);
        category.parentElement.style.backgroundImage = `url('${data.imageSource}')`;
    }
}

//Initialize all the classes
DirectoryScripts.initialize();
DirectoryMain.initialize();
Error.initialize();