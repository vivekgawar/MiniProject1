const express = require('express')
const app = express()
const userModel = require("./models/user")
const postModel = require("./models/post")
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const path = require('path')
const upload = require('./config/multerconfig')

app.set("view engine", "ejs")
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

// basic Slash route
app.get('/', function(req, res){
    res.render("index")
})

// profile pic upload routes
app.get('/profile/upload', function(req, res){
    res.render("profileupload")
})
 
app.post('/upload', isLoggedIn, upload.single("image"), async (req, res) => {
    let user = await userModel.findOne({email: req.user.email})
    user.profilepic = req.file.filename
    await user.save()
    res.redirect('/profile')
})

app.get('/profile', isLoggedIn, async function(req, res){
    let user = await userModel.findOne({email: req.user.email}).populate("posts")
    res.render('profile', {user})
    
})

// like a post routes
app.get('/like/:id', isLoggedIn, async function(req, res){
    let post = await postModel.findOne({_id: req.params.id}).populate("user")
    if(post.likes.indexOf(req.user.userid) === -1){
        post.likes.push(req.user.userid)
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1)
    }
    await post.save()
    res.redirect('/profile')
})

app.get('/edit/:id', isLoggedIn, async function(req, res){
    let post = await postModel.findOne({_id: req.params.id}).populate("user")
    res.render("edit", {post})
})

app.post('/update/:id', isLoggedIn, async function(req, res){
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content})
    res.redirect("/profile")
})


app.post('/post', isLoggedIn, async function(req, res){
    let user = await userModel.findOne({email: req.user.email})
    let {content} = req.body
    let post = await postModel.create({
        user: user._id,
        content: content
    })
    user.posts.push(post._id)
    await user.save()
    res.redirect('/profile')
})

// login route
app.get('/login', function(req, res){
    res.render("login")
})

//  register route
app.post('/register', async function(req, res){
    let {email, password, username, name, age} = req.body;
    let user = await userModel.findOne({email})
    if(user) return res.status(500).send("User already registered with this Email ID!");
    bcrypt.genSalt(10, (err, Salt)=> {
        bcrypt.hash(password, Salt, async(err, hash)=>{
            let user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash,
                posts: []
            })
            let token = jwt.sign({email: email, userid: user._id}, "shhhh")
            res.cookie("token", token)
            res.send("Registered!")
        })
    })
})

app.post('/login', async function(req, res){
    let {email, password} = req.body;
    let user = await userModel.findOne({email})
    if(!user) return res.status(500).send("Something went wrong!");

    bcrypt.compare(password, user.password, function(err, result){
        if(result){
            let token = jwt.sign({email: email, userid: user._id}, "shhhh")
            res.cookie("token", token)
            res.status(200).redirect('/profile')
           
        } 
        else res.redirect('/login')
    })
})

// logout route
app.get('/logout', async function(req, res){
    res.cookie("token", "");
    res.redirect("/login")
})

// middleware function
function isLoggedIn(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) return res.redirect('/login');

        // Verify the token and set req.user
        const data = jwt.verify(token, "shhhh");
        req.user = data;
        next();
    } catch (error) {
        // If there's an error in token verification (e.g., invalid token)
        return res.redirect('/login');
    }
}


app.listen(3000)