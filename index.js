import express from 'express';
import cors from 'cors';
import mongoose from "mongoose";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
const uploadMiddleware = multer({ dest: 'uploads/' });
import fs from 'fs';



import { UserModel }  from './models/User.js';
import { PostModel } from './models/Post.js';

const app = express();

//salt numero de rondas que se realizaran para hashear la password
const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

// middlewares que ejecutan tareas generales, como leer cookies, servir archivos estaticos, etc
// cors permite que usuarios desde otros dominios puedan acceder a los recursos de la api
app.use(cors({ credentials:true , origin:'http://localhost:3000'}));
app.use(express.json()); // => analiza son
app.use(cookieParser()); // => lee y/o analiza las cookies que llegen en la solicitud
//app.use('/uploads', express.static(__dirname + '/uploads')); // => sirve archivos estaticos

// conexion a la DB 
mongoose.connect('mongodb://localhost:27017/blog')
.catch(err => console.log('error unexpected'));


// auth routes
app.post('/register', async (req,res) => {
  const {username,password} = req.body;
  try{
    // usando el metodo create para crear un objeto en base al modelo UserModel esto seria equivalente a instanciar el modelo userModel
    // await User.create({ username,  password })
    const userDoc = new UserModel( { username,  password } ) 
    // antes del metodo save internamente se ejecuta  el metodo validate()
    // este valida el modelo con los datos que llegen de la solicitud si 
    //estos datos no cumplen entonces nunca llegan a guardarse en la db   
    await userDoc.save()
    res.json(userDoc);
  } catch(e) {
    console.log(e);
    res.status(400).json(e);
  }
});


app.post('/login', async (req,res) => {
  try {
    const {username,password} = req.body;
    // buscamos el usuario segun su username
    const userDoc = await UserModel.findOne({username});
    // aqui validamos la veracidad de la contraseña de forma sincrona
    const passOk = await bcrypt.compare(password, userDoc.password);
    // si el password es correcto hacemos esto
    if(!passOk) throw new Error('wrong credentials')
    // logged in
    // si la contraseña es correcta creamos un jwt para la autenticacion
    // este recibe un payload(datos que compondran el token), una clave secreta(llave que cifra y decifra el token)
    // un objeto con opciones entre ellas la fecha de expiracion del token
    const token = jwt.sign( { username, id: userDoc._id} , secret, {})
    if(token) {
        res.cookie('token', token)//establecer encabezados http con la cookie
        .json({ id: userDoc._id, username, token });
    }
  }
  catch(error){
    res.status(500).send({message : error.message})
  }
  
});


app.post('/logout', (req,res) => {
  // seteando el valor de la clave cookie en vacio
  res.cookie('token', '').json('ok');
});



// user routes
app.get('/profile', async(req,res) => {

  try {
    // extrayendo el token del objeto request del objeto cookies para comprabar que el usuario este autenticado antes
    // de intentar hacer dicha operacion
    const {token} = req.cookies;
    console.log(token);
  
    const info = jwt.verify(token, secret, {}) 
    res.json(info);
  }
  catch(error) {
    res.status(500).send({message : error.message})
  }

});



// publication routes
// creando post
app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
    try {
      // en este punto si todo salio bien multer ya habra configurado un objeto file o files
      // en el objeto global request
      const {originalname,path} = req.file;
      // aqui creamos una ruta personalizada para la imagen que se envie
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      const newPath = path+'.'+ext;
      fs.renameSync(path, newPath);

      // extrayendo el token del objeto request del objeto cookies para comprabar que el usuario este autenticado antes
      // de intentar hacer dicha operacion
      const {token} = req.cookies;
      // el info parametro representa el toen descifrado, al descifrarlo este devolvera los datos que componen el token 
      // por ejemplo el username y el id
      const info = jwt.verify(token, secret, {})
      // si la autenticacion salio bien simplemente creamos un nuevo Post
      // con los datos de la solicitud y el id del autor que esta en el token descifrado
      const {title,summary,content} = req.body;

      const postDoc = await PostModel.create({
          title,
          summary,
          content,
          cover:newPath,
          author:info.id,
      });
        
      res.json(postDoc);

    }
    catch(error){
      res.status(500).send({message : error.message})
    } 

});


// actualizando post
app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
    try {
      let newPath = null;
      // si el objeto file existe quiere decir el usuario quiere editar la imagen y esta ya fue procesada por multer
      if (req.file) {
        // aqui creamos una ruta personalizada para la imagen que se envie
        const {originalname,path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path+'.'+ext;
        renameSync(path, newPath);
      }

      // extrayendo el token del objeto request del objeto cookies para comprabar que el usuario este autenticado antes
      // de intentar hacer dicha operacion
      const {token} = req.cookies;
    
      const info = jwt.verify(token, secret, {})
      // si la autenticacion salio bien extraemos los datos de la solicitud entrante
      const {id,title,summary,content} = req.body;

      const postDoc = await PostModel.findById(id);
   
      if(!postDoc)  throw new Error('not found post')  

      // aqui comparamos que el post a actualizar corresponda al usuario autenticado
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      // si el post no le pertene a ese usuario entonces mandamos un mensaje de error
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
      // si es el autor lo actualizamos
      const updatePost = await PostModel.updateOne({_id : id}, {
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
      }) 
     
      res.send(updatePost);
    
    }
    catch(error) {
        res.send({message : error.message})
    }

});


// obteniendo todos post
app.get('/post', async (req,res) => {
  res.json(
    await PostModel.find()
      .populate('author', ['username'])
      .sort({createdAt: -1})
      .limit(20)
  );
});

 

// obteniendo un post 
app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await PostModel.findById(id)
  .populate('author', ['username']);
  res.json(postDoc);
})


app.listen(4000, () => console.log(`server listening on port 4000`));
//