#![crate_type = "proc-macro"]
extern crate proc_macro;

use proc_macro::*;
use quote::{quote, ToTokens};

// This derive is actually a no-op, we need the helper attribute for code generation
#[proc_macro_derive(Operations, attributes(operations))]
pub fn derive_commit(_: TokenStream) -> TokenStream {
    TokenStream::new()
}

#[proc_macro_attribute]
pub fn static_data_staging_table(attr: TokenStream, input: TokenStream) -> TokenStream {
    //Add spacetimedb::table attribute for staged table

    let attr_ident = match syn::parse::<syn::Ident>(attr.clone()) {
        Ok(r) => r,
        _ => return input,
    };
    let name = attr.to_string();
    let table_name = syn::Ident::new(format!("staged_{name}").as_str(), attr_ident.span());

    let mut ast: syn::ItemStruct = match syn::parse(input.clone()) {
        Ok(val) => val,
        Err(_) => return input,
    };
    ast.attrs.insert(
        0,
        syn::parse_quote! {
            #[spacetimedb::table(name = #table_name)]
        },
    );
    TokenStream::from(quote!(#ast))
}

#[proc_macro_attribute]
pub fn custom_inter_module_insert(_attr: TokenStream, item: TokenStream) -> TokenStream {
    // Just pass through the item unchanged
    item
}
// Attribute does additional code generation
#[proc_macro_attribute]
pub fn shared_table(_args: TokenStream, input: TokenStream) -> TokenStream {
    //let err = compile_error("Expected usage: #[shared_table] OR #[shared_table(public_region | public_global)]");
    //let args_parsed: syn::ExprAssign = match syn::parse(args) {
    //    Ok(val) => val,
    //    Err(_) => return err,
    //};

    let ast: syn::DeriveInput = match syn::parse(input.clone()) {
        Ok(val) => val,
        Err(_) => return input,
    };

    //Find primary_key name (need for deletes)
    let str = input.to_string();
    let ind = match str.find("primary_key") {
        Some(val) => val,
        None => return compile_error("Missing `primary_key` attribute"),
    };
    let ind2 = str[ind..].find(':').unwrap();
    let pk = str[ind..(ind + ind2)].trim();
    let ind = match pk.rfind("pub") {
        Some(val) => val,
        None => return compile_error("Primary key field must be public"),
    };
    let pk = pk[(ind + 4)..].trim();
    let pk = syn::Ident::new(pk, ast.ident.span());

    let name = &ast.ident;
    let name_snake = camel_to_snake(&name.to_string());
    let name_snake = syn::Ident::new(name_snake.as_str(), name.span());
    let op_type = syn::Ident::new(format!("{}Op", name).as_str(), name.span());
    let gen = quote! {
        use spacetimedb::*;
        impl #name {
            //pub fn insert_local(ctx: &ReducerContext, val: #name) {
            //    ctx.db.#name_snake().insert(val);
            //}
            pub fn insert_shared(ctx: &ReducerContext, val: #name, destination: crate::inter_module::InterModuleDestination) {
                ctx.db.#name_snake().insert(val.clone());

                match destination {
                    crate::inter_module::InterModuleDestination::Global |
                    crate::inter_module::InterModuleDestination::GlobalAndAllOtherRegions => {
                        crate::inter_module::add_global_table_update(|u| {
                            if u.#name_snake.is_none() {
                                u.#name_snake = Some(Vec::new());
                            }
                            u.#name_snake.as_mut().unwrap().push(crate::inter_module::_autogen::#op_type::Insert(val.clone()));
                        });
                    }
                    crate::inter_module::InterModuleDestination::AllOtherRegions => {}
                    crate::inter_module::InterModuleDestination::Region(_) => panic!("Table updates cannot be sent to specific regions"),
                    _ => panic!("Unhandled case"),
                }

                match destination {
                    crate::inter_module::InterModuleDestination::AllOtherRegions |
                    crate::inter_module::InterModuleDestination::GlobalAndAllOtherRegions => {
                        crate::inter_module::add_region_table_update(|u| {
                            if u.#name_snake.is_none() {
                                u.#name_snake = Some(Vec::new());
                            }
                            u.#name_snake.as_mut().unwrap().push(crate::inter_module::_autogen::#op_type::Insert(val));
                        });
                    }
                    _ => { }
                }
            }

            //pub fn delete_local(ctx: &ReducerContext, val: #name) {
            //    ctx.db.#name_snake().delete(val);
            //}
            pub fn delete_shared(ctx: &ReducerContext, val: #name, destination: crate::inter_module::InterModuleDestination) {
                ctx.db.#name_snake().#pk().delete(val.#pk);

                match destination {
                    crate::inter_module::InterModuleDestination::Global |
                    crate::inter_module::InterModuleDestination::GlobalAndAllOtherRegions => {
                        crate::inter_module::add_global_table_update(|u| {
                            if u.#name_snake.is_none() {
                                u.#name_snake = Some(Vec::new());
                            }
                            u.#name_snake.as_mut().unwrap().push(crate::inter_module::_autogen::#op_type::Delete(val.clone()));
                        });
                    }
                    crate::inter_module::InterModuleDestination::AllOtherRegions => {}
                    crate::inter_module::InterModuleDestination::Region(_) => panic!("Table updates cannot be sent to specific regions"),
                    _ => panic!("Unhandled case"),
                }

                match destination {
                    crate::inter_module::InterModuleDestination::AllOtherRegions |
                    crate::inter_module::InterModuleDestination::GlobalAndAllOtherRegions => {
                        crate::inter_module::add_region_table_update(|u| {
                            if u.#name_snake.is_none() {
                                u.#name_snake = Some(Vec::new());
                            }
                            u.#name_snake.as_mut().unwrap().push(crate::inter_module::_autogen::#op_type::Delete(val));
                        });
                    }
                    _ => { }
                }
            }

            pub fn update_shared(ctx: &ReducerContext, val: #name, destination: crate::inter_module::InterModuleDestination) {
                Self::delete_shared(ctx, val.clone(), destination);
                Self::insert_shared(ctx, val, destination);
            }
        }
    };

    let mut gen_tokens = TokenStream::from(gen);
    gen_tokens.extend(input);
    return gen_tokens;
}

//Create a table update accumulator before any reducer code runs
#[proc_macro_attribute]
pub fn shared_table_reducer(_args: TokenStream, input: TokenStream) -> TokenStream {
    let mut ast: syn::ItemFn = match syn::parse(input.clone()) {
        Ok(val) => val,
        Err(_) => return input,
    };

    let gen_start = quote! {
        {
            let __shared_transaction_accumulator = crate::inter_module::SharedTransactionAccumulator { ctx: ctx };
            __shared_transaction_accumulator.begin_shared_transaction();
        }
    };
    let ast_start: syn::Block = syn::parse2(gen_start).unwrap();
    ast.block.stmts.insert(0, ast_start.stmts[0].clone());
    ast.block.stmts.insert(1, ast_start.stmts[1].clone());
    proc_macro::TokenStream::from(ast.into_token_stream())
}

fn camel_to_snake(str: &String) -> String {
    let mut output = String::new();
    for c in str.chars() {
        if c.is_uppercase() {
            if String::is_empty(&output) {
                output.push_str(c.to_ascii_lowercase().to_string().as_str());
            } else {
                output.push_str(format!("_{}", c.to_ascii_lowercase()).as_str());
            }
        } else {
            output.push_str(c.to_string().as_str());
        }
    }
    return output;
}

//Create a timer table for client events
#[proc_macro_attribute]
pub fn event_table(args: TokenStream, input: TokenStream) -> TokenStream {
    //Parse parameters
    let err = compile_error("Expected usage: #[event_table(name=table_name)]");
    let args_parsed: syn::ExprAssign = match syn::parse(args) {
        Ok(val) => val,
        Err(_) => return err,
    };

    let mut is_valid = false;
    let mut table_name = String::new();
    if let syn::Expr::Path(left) = *args_parsed.left {
        if let syn::Expr::Path(right) = *args_parsed.right {
            if left.path.segments.len() == 1 && left.path.segments[0].ident.to_string() == "name" && right.path.segments.len() == 1 {
                is_valid = true;
                table_name = right.path.segments[0].ident.to_string();
            }
        }
    }
    if !is_valid {
        return err;
    }

    //Parse input
    let ast: syn::DeriveInput = match syn::parse(input.clone()) {
        Ok(val) => val,
        Err(_) => return input,
    };
    let name = &ast.ident;
    let span = name.span();
    let table_name = syn::Ident::new(table_name.as_str(), span);
    let reducer_name = syn::Ident::new(format!("{}_reducer", table_name).as_str(), span);

    //Generate timer table fields
    let gen_fields = quote! {
        struct Tmp {
            #[primary_key]
            #[auto_inc]
            pub scheduled_id: u64,
            pub scheduled_at: spacetimedb::ScheduleAt,
        }
    };
    //Generate struct, impl and reducer
    let gen = quote! {
        #[spacetimedb::table(name = #table_name, public, scheduled(#reducer_name, at = scheduled_at))]
        pub struct #name {
            //Fields are added later on
        }

        impl #name {
            pub fn new_event(ctx: &spacetimedb::ReducerContext) {
                let val = #name {
                    scheduled_id: 0,
                    scheduled_at: ctx.timestamp.into(),
                };
                //We can't simply do `ctx.db.#name_snake().insert(val)` as that requires importing a trait
                let table = #table_name::#table_name(&ctx.db);
                spacetimedb::Table::insert(table, val);
            }
        }

        #[spacetimedb::reducer]
        fn #reducer_name(_ctx: &spacetimedb::ReducerContext, _timer: #name) { }
    };

    let mut ast_gen: syn::File = syn::parse2(gen).unwrap();
    let ast_gen_fields: syn::ItemStruct = syn::parse2(gen_fields).unwrap();
    if let syn::Data::Struct(src_struct) = &ast.data {
        //Combine generated code for struct
        if let syn::Item::Struct(s) = &mut ast_gen.items[0] {
            //Copy original fields
            s.fields = src_struct.fields.clone();

            //Add timer table fields
            if let syn::Fields::Named(fields) = &mut s.fields {
                if let syn::Fields::Named(extra_fields) = &ast_gen_fields.fields {
                    for i in 0..extra_fields.named.len() {
                        fields.named.insert(i, extra_fields.named[i].clone());
                    }
                }
            }
        }

        //Add struct parameters to new_event
        if let syn::Item::Impl(imp) = &mut ast_gen.items[1] {
            if let syn::ImplItem::Fn(f) = &mut imp.items[0] {
                //Add arguments to fn def
                for field in &src_struct.fields {
                    let field = field.clone();
                    f.sig.inputs.push(syn::FnArg::Typed(syn::PatType {
                        attrs: vec![],
                        colon_token: syn::token::Colon { spans: [span] },
                        pat: Box::new(syn::Pat::Ident(syn::PatIdent {
                            attrs: vec![],
                            by_ref: None,
                            mutability: None,
                            ident: field.ident.unwrap(),
                            subpat: None,
                        })),
                        ty: Box::new(field.ty),
                    }));
                }

                //Add fields to table row
                if let syn::Stmt::Local(loc) = &mut f.block.stmts[0] {
                    if let Some(init) = &mut loc.init {
                        if let syn::Expr::Struct(s) = &mut *init.expr {
                            for field in &src_struct.fields {
                                let field = field.clone();
                                let mut segments = syn::punctuated::Punctuated::new();
                                segments.push(syn::PathSegment {
                                    ident: field.ident.clone().unwrap(),
                                    arguments: syn::PathArguments::None,
                                });
                                s.fields.push(syn::FieldValue {
                                    attrs: vec![],
                                    member: syn::Member::Named(field.ident.clone().unwrap()),
                                    colon_token: None,
                                    expr: syn::Expr::Path(syn::ExprPath {
                                        attrs: vec![],
                                        qself: None,
                                        path: syn::Path {
                                            leading_colon: None,
                                            segments,
                                        },
                                    }),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    proc_macro::TokenStream::from(ast_gen.into_token_stream())
}

fn compile_error(err: &str) -> TokenStream {
    return proc_macro::TokenStream::from(syn::Error::new(proc_macro2::Span::from(Span::call_site()), err.to_string()).to_compile_error());
}
