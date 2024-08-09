import {Schema, model} from 'mongoose';
import colors from 'colors'
import bcrypt from 'bcryptjs';

 const UserSchema = new Schema({
    username: {type: String, required: true, minLength: 4,
    /* unique es una restriccion propia de mongo Db no de mongoose
       por eso se maneja de forma distinta, es decir moongose no 
       sabe como responder o manejar una restriccion que no esta 
       en su control, es por eso que la logica pre guardado se ejecuta,
       ya que si bien es cierto el username pueda estar repetido como
       este no es una responsabilidad de mongoose este no lo maneja y
       sigue la logica preguardado, pero antes de entrar a la Db mongo
       db si lo valida ya que esta validacion es propio de la db 
    */ 
    unique: true},

  //age : {type : Number, min : 4, max : 20, required :true},

  password: {type: String, required: true, minLength : 6},

});

/* La validación siempre se ejecuta como el primer pre('save') gancho. Esto
   significa que la validación no se ejecuta en ningún cambio que realice en
   pre('save')los ganchos. 
*/
UserSchema.pre('save', async function (next) {

  console.log(`siempre se ejecuta antes de guardar y este es el dato entrante ${this}`.magenta);
  //this.age = this.age-100 => si esto cambia mongoose no lo volvera a validar aunque este cambio no cumpla con el esquema establecido
  this.password = await bcrypt.hash(this.password, 10)
  next()

})


export const UserModel = model('User', UserSchema);


