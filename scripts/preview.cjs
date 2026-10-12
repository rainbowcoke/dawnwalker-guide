const {serve}=require('./server.cjs');
serve(Number(process.env.PORT||8000)).then(server=>console.log('Local: '+server.base('/dawnwalker-guide/'))).catch(error=>{console.error(error.message);process.exitCode=1;});
