---
layout: post
title: "Dependency lookup with binding_of_caller"
description: ""
category: 
tags:
  - ruby
  - rails
---

Rails project, RetailersController, products action, circa 2013 AD:

{% highlight ruby %}
def products
  @products = current_retailer.
    products.order('created_at desc').
    paginate(page: params[:page], per_page: 20)
end
{% endhighlight %}

That query is not too bad. I can totally live with it. But I've been roaming around this controller for the last few days and every time I am passing by this piece of code it just does not make the journey better. The effect is somewhat enhanced by three other actions that look identical to this one (except they query for other things). So today I finally stopped and decided to sort it out like a pro! Well. That, and I had to to put some tests around those actions and stubbing out a query such as the one above is just so much the opposite of fun... But that would be a boring start for a post.

Despite Rails community actively exploring The Right Way™ to deal with the logic that does not fit into Rails MVC, the most common thing amongst those who just need to Get Shit Done™ is to move the query logic into model. Ok. Second most common. The first one admittedly is to leave it as is and get some shit done instead. However, I do not belong to that category of people, since I am writing this post instead of getting shit done. And neither are you, since you are reading this post instead of getting shit done. So let us disregard those lucky bastards and see what is down that rabbit hole.

Ok, moving the query into the model is not cool. So what is? I don't know! And when I don't know, I tend to start with making stuff up. What would an ideal client code look like? It would be nice to have something that is easy to stub out in controller test. Also, it would make it more readable to see where the products are coming from. And certainly none of the pagination/sorting machinery should make it through. Something like this:

{% highlight ruby %}
def products
  @products = PrepareForTableView.relation(current_retailer.products)
end
{% endhighlight %}

This way retailer is still aware of its products but on the other hand controller does not need to know how to sort and paginate. Also, it looks like a decorator. Or presenter? Whatever. Design patterns - check.

The slightly annoying problem however is that it is not going to work. At least not without also passing `params[:page]`. Ok. How does it look now?

{% highlight ruby %}
@products = PrepareForTableView.relation(current_retailer.products, page: params[:page])
{% endhighlight %}

Acceptable. But not as good as before. What can be done?

Conventions work great for Rails. So let us introduce one. The one that postulates that `PrepareForTableView` is only ever going to be used in a controller. So what? Well that means that its methods will always be called from the context of a controller. If only we could get hold of that context. Oh, wait. Isn't it what ruby `Binding` is for?

Quick recap: 

> Objects of class Binding encapsulate the execution context at some
> particular place in the code and retain this context for future use.
> The variables, methods, value of self, and possibly an iterator block
> that can be accessed in this context are all retained.

Ok, but how is this useful? The profit comes from the fact that ruby can `eval` stuff in specified context (binding). Like this:

{% highlight ruby %}
page = controller_context.eval("params[:page]")
{% endhighlight %}

So all that is needed for our case is access to binding of caller. [binding_of_caller](https://github.com/banister/binding_of_caller) gem does just that (and does it well):

{% highlight ruby %}
module PrepareForTableView
  module_function

  def relation relation
    page = binding.of_caller(1).eval("params[:page]")
    relation.order('created_at desc').paginate(page: page, per_page: 20)
  end
end
{% endhighlight %}

Good.

Now let us finally get some shit done and allow retailer to download products in xls. xls version does not require sorting. Also our client is specific about having more than one page worth of data in there. Having controller context at hand gives our module a lot of flexibility so the above can be achieved without even changing client code:

{% highlight ruby %}
# renamed as it is no longer just about table view
module WithinRequestContext
  module_function

  def adjust_data relation
    request, params = binding.of_caller(1).eval('[request, params]')

    if request.format == Mime::HTML
      relation.order('created_at desc').paginate(page: params[:page], per_page: 20)
    else
      relation
    end
  end
end
{% endhighlight %}

The client code remains the same:

{% highlight ruby %}
def products
  @products = WithinRequestContext.adjust_data(current_retailer.products)
end
{% endhighlight %}

Last, but not least. Unit testing this module is simple. The test just needs to have `params` and `request` defined:

{% highlight ruby %}
    describe WithinRequestContext do
      let(:request) { stub('request') }
      let(:params) { {page: 1} }
      let(:relation) { stub('relation') }

      before do
         # relation follows builder pattern, so should the stub
         relation.stub(:paginate).and_return(relation)
         relation.stub(:order).and_return(relation)
      end

      describe "#adjust_data" do
        context "Non HTML request" do
          before do
            request.stub(:format).and_return('some mime type')
          end

          it "returns unmodified relation" do
            relation.should_not_receive(:order)
            relation.should_not_receive(:paginate)

            WithinRequestContext.adjust_data(relation).should == relation
          end
        end

        context "HTML request" do
          before do
            request.stub(:format).and_return(Mime::HTML)
          end

          it "paginates" do
            relation.should_receive(:paginate).with(page: 1, per_page: 20)
            WithinRequestContext.adjust_data(relation).should == relation
          end

          it "orders by created_at desc" do
            relation.should_receive(:order).with('created_at desc')
            WithinRequestContext.adjust_data(relation).should == relation
          end
        end
      end
    end
{% endhighlight %}

That is all I've got on dependency lookup with [binding_of_caller](https://github.com/banister/binding_of_caller) - an awesome little gem used by [pry-stack_explorer](https://github.com/pry/pry-stack_explorer) and [better_errors](https://github.com/charliesome/better_errors).

It is worth mentioning that _it is all fun and games til someone has to maintain it_. I'll wait till then before start recommending the above approach... But you don't have to!

{% include JB/setup %}
